import "dotenv/config";
import { z } from "zod";

const baseSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
});

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function baseConfig() {
  return baseSchema.parse(process.env);
}

export function ingressConfig() {
  return baseSchema
    .extend({
      SLACK_BOT_TOKEN: z.string().min(1),
      SLACK_APP_TOKEN: z.string().min(1),
    })
    .parse(process.env);
}

export function fellowConfig() {
  return baseSchema
    .extend({
      ENV_CHANNEL_ID: z.string().min(1),
      ENV_ACTIVATION_KEYWORDS: z.string().min(1),
      FELLOW_IDENTITY: z.string().min(1).default("Fellow"),
      LLM_API_BASE: z.string().url().default("http://localhost:8001/v1"),
      LLM_API_KEY: z.string().min(1).default("local-proxy-placeholder"),
      LLM_MODEL: z.string().min(1).default("gpt-4.1"),
    })
    .parse(process.env);
}

export function foundryConfig() {
  return baseSchema
    .extend({
      ENV_CHANNEL_ID: z.string().min(1),
      FOUNDRY_WORKSPACE: z.string().min(1).default("/workspace"),
    })
    .parse(process.env);
}

export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
