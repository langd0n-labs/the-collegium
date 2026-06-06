import type { Redis } from "ioredis";
import { fellowConfig, parseCsv } from "../shared/config.js";
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
  private readonly stream: string;
  private readonly llmApiBase: string;
  private readonly llmApiKey: string;
  private readonly llmModel: string;
  private lastId = "$";

  constructor(private readonly redis: Redis) {
    const config = fellowConfig();
    this.channelId = config.ENV_CHANNEL_ID;
    this.activationKeywords = parseCsv(config.ENV_ACTIVATION_KEYWORDS).map((keyword) =>
      keyword.toLowerCase(),
    );
    this.identity = config.FELLOW_IDENTITY;
    this.llmApiBase = config.LLM_API_BASE;
    this.llmApiKey = config.LLM_API_KEY;
    this.llmModel = config.LLM_MODEL;
    this.stream = streamName(this.channelId);
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
          await this.handleMessage(message);
        }
      }
    }
  }

  private async handleMessage(message: CollegiumMessage): Promise<void> {
    if (!message.text || !this.shouldActivate(message.text)) {
      return;
    }

    const threadHistory = await this.loadThreadHistory(message.thread_ts);
    const response = await generateFellowResponse({
      apiBase: this.llmApiBase,
      apiKey: this.llmApiKey,
      model: this.llmModel,
      identity: this.identity,
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
      await this.redis.xadd(
        OUTBOUND_STREAM,
        "*",
        ...flattenPayload({
          channel_id: message.channel_id,
          thread_ts: message.thread_ts,
          text: cleanedText,
        }),
      );
    }
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
}
