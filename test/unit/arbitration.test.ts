import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideFellowTurn } from "../../src/fellow/arbitration.js";

const baseMessage = {
  channel_id: "C001",
  thread_ts: "1000.0001",
  user: "U001",
  text: "let's discuss the lecture",
  ts: "1000.0001",
};

describe("decideFellowTurn", () => {
  it("skips when the fellow is the author", () => {
    const result = decideFellowTurn({
      message: { ...baseMessage, user: "Pedagogy Lead" },
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: false, reason: "self" });
  });

  it("skips when already answered", () => {
    const result = decideFellowTurn({
      message: baseMessage,
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture"],
      alreadyAnswered: true,
    });
    assert.deepEqual(result, { speak: false, reason: "already_answered" });
  });

  it("skips when text is empty", () => {
    const result = decideFellowTurn({
      message: { ...baseMessage, text: "" },
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: false, reason: "empty" });
  });

  it("skips when no keyword matches", () => {
    const result = decideFellowTurn({
      message: { ...baseMessage, text: "hello world" },
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture", "scaffold"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: false, reason: "inactive" });
  });

  it("speaks when a keyword matches", () => {
    const result = decideFellowTurn({
      message: baseMessage,
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture", "scaffold"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: true });
  });

  it("keyword match is case-insensitive", () => {
    const result = decideFellowTurn({
      message: { ...baseMessage, text: "LECTURE on concepts" },
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: true });
  });

  it("keyword match is substring match", () => {
    const result = decideFellowTurn({
      message: { ...baseMessage, text: "prelectures and scaffolding" },
      fellowName: "Pedagogy Lead",
      activationKeywords: ["lecture"],
      alreadyAnswered: false,
    });
    assert.deepEqual(result, { speak: true });
  });
});
