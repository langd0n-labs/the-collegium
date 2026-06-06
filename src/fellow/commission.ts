import type { CommissionPayload } from "../shared/types.js";

export interface CommissionExtraction {
  cleanedText: string;
  commissions: CommissionPayload[];
}

export function extractCommissions(text: string): CommissionExtraction {
  const commissions: CommissionPayload[] = [];
  let cleanedText = "";
  let cursor = 0;

  while (cursor < text.length) {
    const markerIndex = text.indexOf("COMMISSION:", cursor);
    if (markerIndex === -1) {
      cleanedText += text.slice(cursor);
      break;
    }

    cleanedText += text.slice(cursor, markerIndex);
    const jsonStart = text.indexOf("{", markerIndex);
    if (jsonStart === -1) {
      cleanedText += text.slice(markerIndex);
      break;
    }

    const jsonEnd = findMatchingBrace(text, jsonStart);
    if (jsonEnd === -1) {
      cleanedText += text.slice(markerIndex);
      break;
    }

    const jsonText = text.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(jsonText) as CommissionPayload;
      commissions.push(parsed);
    } catch {
      cleanedText += text.slice(markerIndex, jsonEnd + 1);
    }

    cursor = jsonEnd + 1;
  }

  return {
    cleanedText: cleanedText.replace(/[ \t]+\n/g, "\n").trim(),
    commissions,
  };
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
