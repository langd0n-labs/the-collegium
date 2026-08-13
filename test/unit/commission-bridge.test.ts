import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CommissionBridge, type IssuePublisher, type Recommendation, type ThreadWriter } from "../../src/experiment/commission-bridge.js";

const recommendation: Recommendation = {
  eventId: "recommendation-1",
  requestedRatifier: "human-test-key",
  sourceThread: "buzz-thread-1",
  outcome: "Add a recommendation and ratification lifecycle to file mode",
  requirements: ["Do not queue raw Fellow output"],
  acceptanceCriteria: ["One authorized ratification produces one Commission"],
};

class FakePublisher implements IssuePublisher {
  created = 0;
  readonly issues = new Map<string, string>();
  async findByCommissionId(commissionId: string): Promise<string | undefined> { return this.issues.get(commissionId); }
  async create({ commissionId }: { title: string; bodyFile: string; commissionId: string }): Promise<string> {
    this.created += 1;
    const url = `https://example.test/issues/${this.created}`;
    this.issues.set(commissionId, url);
    return url;
  }
}

class FakeThreads implements ThreadWriter {
  messages: string[] = [];
  async post(_thread: string, message: string): Promise<void> { this.messages.push(message); }
}

async function makeBridge() {
  const directory = await mkdtemp(join(tmpdir(), "commission-bridge-"));
  const publisher = new FakePublisher();
  const threads = new FakeThreads();
  return {
    directory,
    publisher,
    threads,
    bridge: new CommissionBridge(
      { get: async (id) => id === recommendation.eventId ? recommendation : undefined },
      { verify: async (event) => event.eventId !== "ratify-invalid" },
      publisher,
      threads,
      join(directory, "outbox.json"),
      join(directory, "bodies"),
    ),
  };
}

test("never creates a delivery record before an explicit ratification", async () => {
  const { bridge, publisher, directory } = await makeBridge();
  const result = await bridge.handle({ eventId: "return-1", recommendationEventId: recommendation.eventId, signer: "human-test-key", action: "return", returnReason: "need clearer risk" });
  assert.equal(result.status, "returned");
  assert.equal(publisher.created, 0);
  await assert.rejects(readFile(join(directory, "outbox.json"), "utf8"), { code: "ENOENT" });
});

test("rejects an unauthorized signer without an Issue", async () => {
  const { bridge, publisher } = await makeBridge();
  const result = await bridge.handle({ eventId: "ratify-1", recommendationEventId: recommendation.eventId, signer: "wrong-key", action: "ratify" });
  assert.equal(result.status, "rejected");
  assert.equal(publisher.created, 0);
});

test("rejects a missing recommendation or invalid signature without an Issue", async () => {
  const { bridge, publisher } = await makeBridge();
  const missing = await bridge.handle({ eventId: "ratify-missing", recommendationEventId: "missing", signer: "human-test-key", action: "ratify" });
  const invalid = await bridge.handle({ eventId: "ratify-invalid", recommendationEventId: recommendation.eventId, signer: "human-test-key", action: "ratify" });
  assert.equal(missing.status, "rejected");
  assert.equal(invalid.status, "rejected");
  assert.equal(publisher.created, 0);
});

test("writes an outbox before delivery and replays idempotently", async () => {
  const { bridge, publisher, directory } = await makeBridge();
  const event = { eventId: "ratify-1", recommendationEventId: recommendation.eventId, signer: "human-test-key", action: "ratify" as const };
  const first = await bridge.handle(event);
  const replay = await bridge.handle(event);
  assert.equal(first.status, "delivered");
  assert.equal(replay.status, "duplicate");
  assert.equal(publisher.created, 1);
  assert.match(await readFile(join(directory, "outbox.json"), "utf8"), /https:\/\/example\.test\/issues\/1/);
});
