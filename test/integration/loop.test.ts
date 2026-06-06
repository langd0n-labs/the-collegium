/**
 * Integration test: four-step deliberation loop via file adapter with real Redis.
 *
 * Requires a Redis server at REDIS_URL (default redis://localhost:6379).
 * Run via: npm run test:integration
 *
 * What it verifies (issue #2 commit 8af5cff consumer-group fix end-to-end):
 *   1. A message injected via FileIngress is published to the Redis stream.
 *   2. Two Fellows read from the stream (PEL drain + new-message fallback).
 *   3. Fellows hear each other's responses and deliberate.
 *   4. Deliberation terminates at the turn cap.
 *   5. One Commission from Fellow output reaches the Forge.
 *   6. The Forge writes one real artifact file to the workspace.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Redis } from "ioredis";
import { PersonaWorker } from "../../src/fellow/persona-worker.js";
import { ForgeWorker } from "../../src/forge/forge-worker.js";
import { FileIngress, FileEgress } from "../../src/ingress/adapters/file.js";
import {
  OUTBOUND_STREAM,
  appendThreadHistory,
  createRedis,
  flattenPayload,
  hydratePayload,
  streamName,
} from "../../src/shared/redis.js";

// ---------------------------------------------------------------------------
// LLM stub server
// ---------------------------------------------------------------------------

function createLlmStub(): {
  port: number;
  close: () => Promise<void>;
} {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      let content =
        "This lecture and pedagogy approach is well structured.";

      try {
        const data = JSON.parse(body) as {
          messages?: Array<{ role: string; content: string }>;
        };
        const systemMsg = data.messages?.find((m) => m.role === "system");
        const isPedagogyLead = systemMsg?.content?.includes("Pedagogy Lead") ?? false;

        if (isPedagogyLead) {
          // Response activates Assessment Strategist (keyword "assessment") and emits a commission
          content =
            'Here is my perspective on assessment and rubric design for the course. ' +
            'COMMISSION: {"forge":"record","params":{"title":"DS100 Assessment Framework","body":"Framework for course assessment and evaluation."}}';
        } else {
          // Assessment Strategist response — activates Pedagogy Lead (keyword "lecture")
          content =
            "Agreed. The lecture structure should align with these assessment criteria.";
        }
      } catch {
        // use default content
      }

      const response = {
        id: "stub-completion",
        object: "chat.completion",
        model: "gpt-4.1",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    });
  });

  server.listen(0);
  const addr = server.address() as { port: number };

  return {
    port: addr.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

describe("four-step deliberation loop (file mode + real Redis)", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let manifestPath: string;
  let inputFile: string;
  let egressFile: string;
  let llmStub: { port: number; close: () => Promise<void> };
  const redisConnections: Redis[] = [];
  const abortControllers: AbortController[] = [];

  before(async () => {
    llmStub = createLlmStub();

    // loadFellowFromManifest resolves persona paths as:
    //   resolve(dirname(manifestPath), "..", fellow.persona_file)
    // So for manifest at <root>/collegia/manifest.yaml and persona_file "personas/foo.md",
    // it looks at <root>/personas/foo.md. Mirror that layout in the temp dir.
    tmpDir = await mkdtemp(join(tmpdir(), "collegium-test-"));
    workspaceDir = join(tmpDir, "workspace");
    await mkdir(workspaceDir, { recursive: true });

    // Write minimal persona files at <tmpDir>/personas/
    const personasDir = join(tmpDir, "personas");
    await mkdir(personasDir, { recursive: true });
    await writeFile(
      join(personasDir, "pedagogy-lead.md"),
      "You are the Pedagogy Lead. Your expertise is in lecture design and curriculum development.",
    );
    await writeFile(
      join(personasDir, "assessment-strategist.md"),
      "You are the Assessment Strategist. Your expertise is in assessment rubrics and examination design.",
    );

    // Write manifest at <tmpDir>/collegia/manifest.yaml so that ".." resolves to <tmpDir>
    const collegiaDir = join(tmpDir, "collegia");
    await mkdir(collegiaDir, { recursive: true });

    const channelId = "test-ch-001";
    const manifestContent = [
      `channel_id: "${channelId}"`,
      "fellows:",
      '  - name: "Pedagogy Lead"',
      `    persona_file: "personas/pedagogy-lead.md"`,
      '    activation_keywords: ["lecture", "pedagogy"]',
      '  - name: "Assessment Strategist"',
      `    persona_file: "personas/assessment-strategist.md"`,
      '    activation_keywords: ["assessment", "rubric"]',
      "forges:",
      '  - name: "record"',
      "    skill_files: []",
    ].join("\n");
    manifestPath = join(collegiaDir, "test-manifest.yaml");
    await writeFile(manifestPath, manifestContent);

    inputFile = join(tmpDir, "input.ndjson");
    egressFile = join(tmpDir, "egress.log");

    // Seed input file with the initial message
    const threadTs = "1717689600.000000";
    const msg = {
      channel_id: channelId,
      thread_ts: threadTs,
      user: "human",
      text: "Please discuss the lecture format for this course",
      ts: threadTs,
    };
    await writeFile(inputFile, JSON.stringify(msg) + "\n");
  });

  after(async () => {
    for (const ac of abortControllers) {
      ac.abort();
    }
    for (const r of redisConnections) {
      try {
        r.disconnect();
      } catch {
        // ignore
      }
    }
    await llmStub.close();
  });

  function makeRedis(): Redis {
    const r = createRedis();
    redisConnections.push(r);
    return r;
  }

  it("two Fellows deliberate, turn cap fires, commission reaches Forge, artifact is written", async () => {
    const channelId = "test-ch-001";
    const apiBase = `http://127.0.0.1:${llmStub.port}/v1`;

    // Flush test keys (best-effort clean slate)
    const adminRedis = makeRedis();
    await adminRedis.flushdb();

    // Set env vars consumed by PersonaWorker.create() and ForgeWorker.create()
    process.env["REDIS_URL"] = process.env["REDIS_URL"] || "redis://localhost:6379";
    process.env["COLLEGIUM_MANIFEST"] = manifestPath;
    process.env["LLM_API_BASE"] = apiBase;
    process.env["LLM_API_KEY"] = "stub-key";
    process.env["LLM_MODEL"] = "gpt-4.1";
    process.env["DELIBERATION_TURN_CAP"] = "2";
    process.env["FORGE_WORKSPACE"] = workspaceDir;
    process.env["FORGE_NAME"] = "record";

    // Create Pedagogy Lead worker
    process.env["FELLOW_NAME"] = "Pedagogy Lead";
    const pgWorker = await PersonaWorker.create(makeRedis());

    // Create Assessment Strategist worker
    process.env["FELLOW_NAME"] = "Assessment Strategist";
    const asWorker = await PersonaWorker.create(makeRedis());

    // Create Forge worker
    const forgeWorker = await ForgeWorker.create(makeRedis());

    // Create file adapters
    const fileIngress = new FileIngress(inputFile, "replay");
    const fileEgress = new FileEgress(egressFile);

    // Start all workers (intentionally not awaited — they run event-loop loops)
    const workerErrors: Error[] = [];
    const pgRun = pgWorker.run().catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes("Connection is closed"))) {
        workerErrors.push(e as Error);
      }
    });
    const asRun = asWorker.run().catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes("Connection is closed"))) {
        workerErrors.push(e as Error);
      }
    });
    const forgeRun = forgeWorker.run().catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes("Connection is closed"))) {
        workerErrors.push(e as Error);
      }
    });

    // Egress loop: read OUTBOUND_STREAM and write to egress file
    const egressRedis = makeRedis();
    let egressLastId = "0-0";
    const egressLoop = (async () => {
      while (true) {
        try {
          const result = await egressRedis.xread(
            "BLOCK",
            2000,
            "STREAMS",
            OUTBOUND_STREAM,
            egressLastId,
          );
          if (!result) continue;
          for (const [, messages] of result) {
            for (const [id, fields] of messages) {
              egressLastId = id;
              const payload = hydratePayload(fields);
              if (payload["text"] && payload["channel_id"] && payload["thread_ts"]) {
                await fileEgress.send({
                  channel_id: payload["channel_id"],
                  thread_ts: payload["thread_ts"],
                  text: payload["text"],
                });
              }
            }
          }
        } catch {
          break;
        }
      }
    })();

    // Give workers a moment to set up consumer groups
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    // Start file ingress — replays the seed message into Redis
    const ingressRedis = makeRedis();
    await fileIngress.start(async (msg) => {
      const sp = { channel_id: msg.channel_id, thread_ts: msg.thread_ts, user: msg.user, text: msg.text, ...(msg.ts ? { ts: msg.ts } : {}) };
      await ingressRedis.xadd(streamName(msg.channel_id), "*", ...flattenPayload(sp));
      await appendThreadHistory(ingressRedis, msg);
    });

    // Poll for artifact with a 30-second deadline
    const deadline = Date.now() + 30_000;
    let artifacts: string[] = [];
    while (Date.now() < deadline) {
      try {
        artifacts = await readdir(workspaceDir);
        artifacts = artifacts.filter((f) => f.endsWith(".md") || f.endsWith(".txt"));
      } catch {
        artifacts = [];
      }
      if (artifacts.length > 0) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }

    // --- Assertions ---

    assert.ok(artifacts.length > 0, `Forge should have written an artifact; found: ${artifacts.join(", ")}`);

    // Outbound stream should have at least 2 deliberation messages
    const outbound = await adminRedis.xrange(OUTBOUND_STREAM, "-", "+");
    assert.ok(outbound.length >= 2, `Expected ≥2 outbound messages, got ${outbound.length}`);

    // Depth notice should have been posted (turn cap reached)
    const hasDepthNotice = outbound.some(([, fields]) => {
      const payload = hydratePayload(fields);
      return payload["text"]?.includes("Deliberation depth reached") ?? false;
    });
    assert.ok(hasDepthNotice, "Expected a depth notice in outbound stream");

    // Commission queue should be empty (processed by Forge)
    const commissionQueue = `forge:commission:${channelId}`;
    const queueLen = await adminRedis.llen(commissionQueue);
    assert.equal(queueLen, 0, "Commission queue should be drained by Forge");

    assert.equal(workerErrors.length, 0, `Worker errors: ${workerErrors.map((e) => e.message).join(", ")}`);

    // suppress promise-related lint; workers terminate on redis.disconnect() in after()
    void pgRun;
    void asRun;
    void forgeRun;
    void egressLoop;
  });
});
