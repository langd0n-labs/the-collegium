import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCommissions } from "../../src/fellow/commission.js";

describe("extractCommissions", () => {
  it("returns unchanged text when no marker present", () => {
    const { cleanedText, commissions } = extractCommissions("Hello world");
    assert.equal(cleanedText, "Hello world");
    assert.deepEqual(commissions, []);
  });

  it("extracts a single commission and removes it from text", () => {
    const input = 'Here is my reply. COMMISSION: {"forge":"record","params":{"title":"Test"}} Done.';
    const { cleanedText, commissions } = extractCommissions(input);
    // The space before COMMISSION: and after } both remain, producing a double space
    assert.equal(cleanedText, "Here is my reply.  Done.");
    assert.equal(commissions.length, 1);
    assert.deepEqual(commissions[0], { forge: "record", params: { title: "Test" } });
  });

  it("extracts multiple commissions", () => {
    const input =
      'First COMMISSION: {"forge":"a"} middle COMMISSION: {"forge":"b"} end';
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(cleanedText, "First  middle  end");
    assert.equal(commissions.length, 2);
    assert.equal(commissions[0]!.forge, "a");
    assert.equal(commissions[1]!.forge, "b");
  });

  it("handles nested braces in commission JSON", () => {
    const input =
      'Text COMMISSION: {"forge":"record","params":{"nested":{"a":1}}} tail';
    const { cleanedText, commissions } = extractCommissions(input);
    // space before COMMISSION: and after } both remain
    assert.equal(cleanedText, "Text  tail");
    assert.deepEqual(commissions[0]!.params, { nested: { a: 1 } });
  });

  it("handles braces inside JSON string values without confusion", () => {
    const input =
      'Text COMMISSION: {"forge":"record","description":"use {braces} here"} end';
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(cleanedText, "Text  end");
    assert.equal(commissions[0]!.description, "use {braces} here");
  });

  it("preserves malformed JSON as literal text and does not extract", () => {
    const input = "Text COMMISSION: {forge:broken} end";
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(commissions.length, 0);
    assert.ok(cleanedText.includes("forge:broken"), "malformed JSON kept in text");
  });

  it("handles COMMISSION marker with no following brace", () => {
    const input = "Text COMMISSION: no brace here";
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(commissions.length, 0);
    assert.ok(cleanedText.includes("no brace here"));
  });

  it("handles COMMISSION marker with unmatched brace", () => {
    const input = 'Text COMMISSION: {"forge":"record"';
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(commissions.length, 0);
  });

  it("handles escaped quotes inside JSON string values", () => {
    const input =
      'Text COMMISSION: {"forge":"record","description":"say \\"hello\\""} end';
    const { cleanedText, commissions } = extractCommissions(input);
    assert.equal(cleanedText, "Text  end");
    assert.equal(commissions[0]!.description, 'say "hello"');
  });

  it("trims trailing whitespace from cleaned text", () => {
    const input = "Hello   \nWorld COMMISSION: {} \n";
    const { cleanedText } = extractCommissions(input);
    assert.ok(!cleanedText.endsWith(" "));
    assert.ok(!cleanedText.endsWith("\n"));
  });
});
