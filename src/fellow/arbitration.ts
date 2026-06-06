import type { CollegiumMessage } from "../shared/types.js";

export type TurnDecision =
  | { speak: true }
  | { speak: false; reason: "self" | "already_answered" | "empty" | "inactive" };

export interface TurnDecisionInput {
  message: CollegiumMessage;
  fellowName: string;
  activationKeywords: string[];
  alreadyAnswered: boolean;
}

export function decideFellowTurn(input: TurnDecisionInput): TurnDecision {
  if (input.message.user === input.fellowName) {
    return { speak: false, reason: "self" };
  }

  if (input.alreadyAnswered) {
    return { speak: false, reason: "already_answered" };
  }

  if (!input.message.text) {
    return { speak: false, reason: "empty" };
  }

  const normalized = input.message.text.toLowerCase();
  const active = input.activationKeywords.some((keyword) => normalized.includes(keyword));
  return active ? { speak: true } : { speak: false, reason: "inactive" };
}
