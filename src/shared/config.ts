import "dotenv/config";
import { z } from "zod";

const baseSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  COLLEGIUM_MANIFEST: z.string().min(1).default("collegia/ds100.yaml"),
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
      FELLOW_NAME: z.string().min(1),
      LLM_API_BASE: z.string().url().default("http://localhost:8001/v1"),
      LLM_API_KEY: z.string().min(1).default("local-proxy-placeholder"),
      LLM_MODEL: z.string().min(1).default("gpt-4.1"),
      DELIBERATION_TURN_CAP: z.coerce.number().int().positive().default(8),
    })
    .parse(process.env);
}

export function foundryConfig() {
  return baseSchema
    .extend({
      FORGE_NAME: z.string().min(1).default("record"),
      FOUNDRY_WORKSPACE: z.string().min(1).default("/workspace"),
    })
    .parse(process.env);
}
