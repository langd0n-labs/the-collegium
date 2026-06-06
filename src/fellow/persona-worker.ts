import type { Redis } from "ioredis";
import { fellowConfig } from "../shared/config.js";
import { loadFellowFromManifest } from "../shared/manifest.js";
import {
  OUTBOUND_STREAM,
  commissionQueueName,
  flattenPayload,
  hydratePayload,
  streamName,
} from "../shared/redis.js";
import { generateFellowResponse } from "../shared/llm.js";
import type { CollegiumMessage } from "../shared/types.js";
import { extractCommissions } from "./commission.js";

export class PersonaWorker {
  private readonly channelId: string;
  private readonly activationKeywords: string[];
  private readonly identity: string;
  private readonly persona: string;
  private readonly stream: string;
  private readonly llmApiBase: string;
  private readonly llmApiKey: string;
  private readonly llmModel: string;
  private readonly turnCap: number;
  private lastId = "$";

  private constructor(
    private readonly redis: Redis,
    options: {
      channelId: string;
      activationKeywords: string[];
      identity: string;
      persona: string;
      llmApiBase: string;
      llmApiKey: string;
      llmModel: string;
      turnCap: number;
    },
  ) {
    this.channelId = options.channelId;
    this.activationKeywords = options.activationKeywords.map((keyword) => keyword.toLowerCase());
    this.identity = options.identity;
    this.persona = options.persona;
    this.llmApiBase = options.llmApiBase;
    this.llmApiKey = options.llmApiKey;
    this.llmModel = options.llmModel;
    this.turnCap = options.turnCap;
    this.stream = streamName(this.channelId);
  }

  static async create(redis: Redis): Promise<PersonaWorker> {
    const config = fellowConfig();
    const { manifest, fellow } = await loadFellowFromManifest(
      config.COLLEGIUM_MANIFEST,
      config.FELLOW_NAME,
    );
    return new PersonaWorker(redis, {
      channelId: manifest.channel_id,
      activationKeywords: fellow.activation_keywords,
      identity: fellow.name,
      persona: fellow.persona,
      llmApiBase: config.LLM_API_BASE,
      llmApiKey: config.LLM_API_KEY,
      llmModel: config.LLM_MODEL,
      turnCap: config.DELIBERATION_TURN_CAP,
    });
  }

  async run(): Promise<void> {
    console.log(`${this.identity} listening on ${this.stream}`);
    for (;;) {
      const result = await this.redis.xread("BLOCK", 5000, "STREAMS", this.stream, this.lastId);
      if (!result) {
        continue;
      }

      for (const [, messages] of result) {
        for (const [id, fields] of messages) {
          this.lastId = id;
          const message = hydratePayload(fields) as unknown as CollegiumMessage;
          await this.handleMessage(id, message);
        }
      }
    }
  }

  private async handleMessage(streamId: string, message: CollegiumMessage): Promise<void> {
    if (message.user === this.identity) {
      return;
    }

    if (await this.hasAnswered(streamId, message.thread_ts)) {
      return;
    }

    if (!message.text || !this.shouldActivate(message.text)) {
      return;
    }

    if (await this.isDepthReached(message)) {
      return;
    }

    if (!(await this.acquireThreadLock(message.thread_ts))) {
      return;
    }

    try {
      const threadHistory = await this.loadThreadHistory(message.thread_ts);
      const response = await generateFellowResponse({
        apiBase: this.llmApiBase,
        apiKey: this.llmApiKey,
        model: this.llmModel,
        identity: this.identity,
        persona: this.persona,
        activationKeywords: this.activationKeywords,
        message,
        threadHistory,
      });

      const prefixedResponse = `${this.identity}: ${response}`;
      const { cleanedText, commissions } = extractCommissions(prefixedResponse);

      for (const commission of commissions) {
        await this.redis.lpush(
          commissionQueueName(this.channelId),
          JSON.stringify({
            ...commission,
            channel_id: commission.channel_id || message.channel_id,
            thread_ts: commission.thread_ts || message.thread_ts,
            requested_by: this.identity,
          }),
        );
      }

      if (cleanedText) {
        const turnCount = await this.redis.incr(this.turnCountKey(message.thread_ts));
        if (turnCount > this.turnCap) {
          await this.postDepthNotice(message);
          return;
        }

        const deliberationId = await this.redis.xadd(
          this.stream,
          "*",
          ...flattenPayload({
            channel_id: message.channel_id,
            thread_ts: message.thread_ts,
            user: this.identity,
            text: cleanedText,
          }),
        );

        await this.redis.xadd(
          OUTBOUND_STREAM,
          "*",
          ...flattenPayload({
            channel_id: message.channel_id,
            thread_ts: message.thread_ts,
            text: cleanedText,
          }),
        );

        console.log(`${this.identity} published deliberation ${deliberationId}`);
      }
    } finally {
      await this.releaseThreadLock(message.thread_ts);
    }

    await this.markAnswered(streamId, message.thread_ts);
  }

  private shouldActivate(text: string): boolean {
    const normalized = text.toLowerCase();
    return this.activationKeywords.some((keyword) => normalized.includes(keyword));
  }

  private async loadThreadHistory(threadTs: string): Promise<CollegiumMessage[]> {
    const entries = (await this.redis.xrevrange(
      this.stream,
      "+",
      "-",
      "COUNT",
      50,
    )) as Array<[string, string[]]>;
    return entries
      .map(([, fields]) => hydratePayload(fields) as unknown as CollegiumMessage)
      .filter((message) => message.thread_ts === threadTs)
      .reverse();
  }

  private answeredKey(threadTs: string): string {
    return `collegium:fellow:${this.identity}:answered:${threadTs}`;
  }

  private async hasAnswered(streamId: string, threadTs: string): Promise<boolean> {
    return (await this.redis.sismember(this.answeredKey(threadTs), streamId)) === 1;
  }

  private async markAnswered(streamId: string, threadTs: string): Promise<void> {
    await this.redis.sadd(this.answeredKey(threadTs), streamId);
  }

  private turnCountKey(threadTs: string): string {
    return `collegium:thread:${threadTs}:turns`;
  }

  private depthNoticeKey(threadTs: string): string {
    return `collegium:thread:${threadTs}:depth_notice`;
  }

  private lockKey(threadTs: string): string {
    return `collegium:fellow:${this.identity}:thread:${threadTs}:lock`;
  }

  private async isDepthReached(message: CollegiumMessage): Promise<boolean> {
    const current = Number((await this.redis.get(this.turnCountKey(message.thread_ts))) || "0");
    if (current < this.turnCap) {
      return false;
    }
    await this.postDepthNotice(message);
    return true;
  }

  private async postDepthNotice(message: CollegiumMessage): Promise<void> {
    const shouldPost = await this.redis.set(this.depthNoticeKey(message.thread_ts), "1", "NX");
    if (!shouldPost) {
      return;
    }

    await this.redis.xadd(
      OUTBOUND_STREAM,
      "*",
      ...flattenPayload({
        channel_id: message.channel_id,
        thread_ts: message.thread_ts,
        text: `Deliberation depth reached (${this.turnCap} turns). Halting this thread.`,
      }),
    );
  }

  private async acquireThreadLock(threadTs: string): Promise<boolean> {
    const result = await this.redis.set(this.lockKey(threadTs), "1", "EX", 60, "NX");
    return result === "OK";
  }

  private async releaseThreadLock(threadTs: string): Promise<void> {
    await this.redis.del(this.lockKey(threadTs));
  }
}
