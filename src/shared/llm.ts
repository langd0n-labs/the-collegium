import OpenAI from "openai";
import type { CollegiumMessage } from "./types.js";

interface GenerateResponseOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  identity: string;
  activationKeywords: string[];
  message: CollegiumMessage;
  threadHistory: CollegiumMessage[];
}

export async function generateFellowResponse(options: GenerateResponseOptions): Promise<string> {
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

  return completion.choices[0]?.message?.content?.trim() || "I do not have a response.";
}
