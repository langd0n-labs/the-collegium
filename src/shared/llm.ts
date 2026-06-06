import OpenAI from "openai";
import type { CollegiumMessage } from "./types.js";

interface GenerateResponseOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  identity: string;
  persona: string;
  activationKeywords: string[];
  message: CollegiumMessage;
  threadHistory: CollegiumMessage[];
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface FellowResponse {
  text: string;
  usage?: TokenUsage;
}

export async function generateFellowResponse(options: GenerateResponseOptions): Promise<FellowResponse> {
  const client = new OpenAI({
    baseURL: options.apiBase,
    apiKey: options.apiKey,
  });

  const history = options.threadHistory
    .map((item) => `${item.user}: ${item.text}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: options.model,
    messages: [
      {
        role: "system",
        content: [
          `You are ${options.identity}, a specialized Fellow in The Collegium.`,
          options.persona,
          "Respond concisely and helpfully in the current Slack thread.",
          "If execution or artifact creation is needed, include a structured marker exactly as COMMISSION: {json_payload}.",
          `Activation keywords: ${options.activationKeywords.join(", ")}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "Relevant thread history:",
          history || "(no prior thread history)",
          "",
          "Latest message:",
          `${options.message.user}: ${options.message.text}`,
        ].join("\n"),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() || "I do not have a response.";
  const usage = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      }
    : undefined;

  return { text, usage };
}
