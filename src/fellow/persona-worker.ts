import type { Redis } from "ioredis";
import { fellowConfig } from "../shared/config.js";
import { loadFellowFromManifest } from "../shared/manifest.js";
import {
  OUTBOUND_STREAM,
  appendThreadHistory,
  commissionQueueName,
  fellowConsumerGroupName,
  flattenPayload,
  hydratePayload,
  streamName,
  threadHistoryKey,
} from "../shared/redis.js";
import { generateFellowResponse } from "../shared/llm.js";
import type { CollegiumMessage } from "../shared/types.js";
import { decideFellowTurn } from "./arbitration.js";
import { prepareFellowOutput } from "./commission.js";

type StreamReadResult = Array<[string, Array<[string, string[]]>]> | null;

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
  private readonly consumerGroup: string;
  private readonly consumerName: string;

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
    this.consumerGroup = fellowConsumerGroupName(this.channelId, this.identity);
    this.consumerName = this.identity.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
    await this.ensureConsumerGroup();
    // Replay our pending list first (messages delivered but not yet ACKed — e.g.
    // after a restart), then switch to new messages permanently. Reading id "0"
    // returns the consumer's PEL; when it is empty Redis returns the stream with
    // an *empty message array* (NOT null), so we must detect "empty" explicitly
    // and advance to ">" — a null check alone never advances and starves new reads.
    let readId: "0" | ">" = "0";
    for (;;) {
      const result = await this.readGroupMessages(readId);

      if (this.isEmptyResult(result)) {
        if (readId === "0") {
          readId = ">";
        }
        continue;
      }

      for (const [, messages] of result!) {
        for (const [id, fields] of messages) {
          const message = hydratePayload(fields) as unknown as CollegiumMessage;
          await this.handleMessage(id, message);
          await this.redis.xack(this.stream, this.consumerGroup, id);
        }
      }
    }
  }

  private isEmptyResult(result: StreamReadResult): boolean {
    if (!result) {
      return true;
    }
    return result.every(([, messages]) => messages.length === 0);
  }

  private async handleMessage(streamId: string, message: CollegiumMessage): Promise<void> {
    const decision = decideFellowTurn({
      message,
      fellowName: this.identity,
      activationKeywords: this.activationKeywords,
      alreadyAnswered: await this.hasAnswered(streamId, message.thread_ts),
    });
    if (!decision.speak) {
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
      const { text: response, usage } = await generateFellowResponse({
        apiBase: this.llmApiBase,
        apiKey: this.llmApiKey,
        model: this.llmModel,
        identity: this.identity,
        persona: this.persona,
        activationKeywords: this.activationKeywords,
        message,
        threadHistory,
      });

      // Per-activation cost signal (ADR-0003): measure before pruning. This is the
      // cost-growth seam — a metrics sink can later consume these instead of stdout.
      if (usage) {
        console.log(
          `${this.identity} activation tokens (thread ${message.thread_ts}): ` +
            `prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`,
        );
      }

      const { displayText, commissions } = prepareFellowOutput(this.identity, response);

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

      if (displayText) {
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
            text: displayText,
          }),
        );
        await appendThreadHistory(this.redis, {
          channel_id: message.channel_id,
          thread_ts: message.thread_ts,
          user: this.identity,
          text: displayText,
          ts: deliberationId || undefined,
        });

        await this.redis.xadd(
          OUTBOUND_STREAM,
          "*",
          ...flattenPayload({
            channel_id: message.channel_id,
            thread_ts: message.thread_ts,
            text: displayText,
          }),
        );

        console.log(`${this.identity} published deliberation ${deliberationId}`);
      }
    } finally {
      await this.releaseThreadLock(message.thread_ts);
    }

    await this.markAnswered(streamId, message.thread_ts);
  }

  private async loadThreadHistory(threadTs: string): Promise<CollegiumMessage[]> {
    const entries = await this.redis.lrange(threadHistoryKey(threadTs), 0, -1);
    return entries
      .map((entry) => JSON.parse(entry) as CollegiumMessage)
      .slice(-50);
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

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup("CREATE", this.stream, this.consumerGroup, "0", "MKSTREAM");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
        throw error;
      }
    }
  }

  private async readGroupMessages(id: "0" | ">"): Promise<StreamReadResult> {
    return (this.redis as unknown as {
      xreadgroup: (...args: Array<string | number>) => Promise<StreamReadResult>;
    }).xreadgroup(
      "GROUP",
      this.consumerGroup,
      this.consumerName,
      "BLOCK",
      id === ">" ? 5000 : 1,
      "COUNT",
      10,
      "STREAMS",
      this.stream,
      id,
    );
  }
}
