import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flattenPayload, hydratePayload } from "../../src/shared/redis.js";

describe("flattenPayload / hydratePayload", () => {
  it("round-trips a simple payload", () => {
    const original = { channel_id: "C001", thread_ts: "1000.0", user: "U1", text: "hello" };
    const roundTripped = hydratePayload(flattenPayload(original));
    assert.deepEqual(roundTripped, original);
  });

  it("flattenPayload returns alternating key-value pairs", () => {
    const flat = flattenPayload({ a: "1", b: "2" });
    assert.deepEqual(flat, ["a", "1", "b", "2"]);
  });

  it("hydratePayload ignores trailing key with no value", () => {
    const result = hydratePayload(["a", "1", "b"]);
    assert.equal(result["a"], "1");
    assert.equal(result["b"], undefined);
  });

  it("round-trips a payload with empty string value", () => {
    const original = { key: "" };
    const flat = flattenPayload(original);
    assert.deepEqual(flat, ["key", ""]);
    // hydratePayload: value is "" which is defined but empty
    const result = hydratePayload(flat);
    // "" is a defined value — key is set
    assert.ok("key" in result);
  });

  it("round-trips a realistic outbound payload", () => {
    const original = {
      channel_id: "C0123456789",
      thread_ts: "1717689600.000000",
      text: "This is a deliberation response with special chars: & < >",
    };
    assert.deepEqual(hydratePayload(flattenPayload(original)), original);
  });

  it("empty payload round-trips to empty object", () => {
    assert.deepEqual(hydratePayload(flattenPayload({})), {});
  });
});
