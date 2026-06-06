import { Redis } from "ioredis";
import { baseConfig } from "./config.js";

export type StreamPayload = Record<string, string>;

export function createRedis(): Redis {
  const { REDIS_URL } = baseConfig();
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export function streamName(channelId: string): string {
  return `collegium:stream:${channelId}`;
}

export function commissionQueueName(channelId: string): string {
  return `foundry:commission:${channelId}`;
}

export const OUTBOUND_STREAM = "collegium:outbound";

export function flattenPayload(payload: StreamPayload): string[] {
  return Object.entries(payload).flatMap(([key, value]) => [key, value]);
}

export function hydratePayload(fields: string[]): StreamPayload {
  const payload: StreamPayload = {};
  for (let index = 0; index < fields.length; index += 2) {
    const key = fields[index];
    const value = fields[index + 1];
    if (key && value !== undefined) {
      payload[key] = value;
    }
  }
  return payload;
}
