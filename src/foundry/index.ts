import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { foundryConfig } from "../shared/config.js";
import {
  OUTBOUND_STREAM,
  commissionQueueName,
  createRedis,
  flattenPayload,
} from "../shared/redis.js";
import type { CommissionPayload } from "../shared/types.js";

const execFileAsync = promisify(execFile);
const redis = createRedis();
const config = foundryConfig();
const queue = commissionQueueName(config.ENV_CHANNEL_ID);

async function runShellCommand(command: string, workspace: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync("sh", ["-lc", command], {
    cwd: workspace,
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}

async function listArtifacts(workspace: string): Promise<string[]> {
  const entries = await readdir(workspace);
  const artifacts: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(workspace, entry);
    const info = await stat(absolutePath);
    if (info.isFile()) {
      artifacts.push(entry);
    }
  }

  return artifacts.slice(0, 20);
}

async function describeCommission(commission: CommissionPayload): Promise<string> {
  const description = typeof commission.description === "string" ? commission.description : "";
  const capability = typeof commission.capability === "string" ? commission.capability : "shell";

  if (typeof commission.command === "string" && commission.command.trim()) {
    const output = await runShellCommand(commission.command, config.FOUNDRY_WORKSPACE);
    return [
      `Foundry completed ${capability} commission.`,
      description ? `Description: ${description}` : "",
      output ? `Output:\n${output}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const noteName = `commission-${randomUUID()}.txt`;
  const notePath = join(config.FOUNDRY_WORKSPACE, noteName);
  await writeFile(notePath, `${description || JSON.stringify(commission, null, 2)}\n`, "utf8");

  return `Foundry recorded commission ${noteName}.`;
}

async function handleCommission(raw: string): Promise<void> {
  const commission = JSON.parse(raw) as CommissionPayload;
  const channelId = typeof commission.channel_id === "string" ? commission.channel_id : config.ENV_CHANNEL_ID;
  const threadTs = typeof commission.thread_ts === "string" ? commission.thread_ts : "";

  if (!threadTs) {
    console.warn("Skipping commission without thread_ts", commission);
    return;
  }

  await mkdir(config.FOUNDRY_WORKSPACE, { recursive: true });
  const resultText = await describeCommission(commission);
  const artifacts = await listArtifacts(config.FOUNDRY_WORKSPACE);
  const artifactText = artifacts.length ? `\nArtifacts: ${artifacts.join(", ")}` : "";

  await redis.xadd(
    OUTBOUND_STREAM,
    "*",
    ...flattenPayload({
      channel_id: channelId,
      thread_ts: threadTs,
      text: `${resultText}${artifactText}`,
    }),
  );
}

async function main(): Promise<void> {
  console.log(`Foundry Worker waiting on ${queue}`);
  for (;;) {
    const result = await redis.brpop(queue, 0);
    if (!result) {
      continue;
    }
    const [, raw] = result;
    try {
      await handleCommission(raw);
    } catch (error) {
      console.error("Foundry commission failed", error);
    }
  }
}

main().catch((error) => {
  console.error("Foundry Worker failed", error);
  process.exit(1);
});
