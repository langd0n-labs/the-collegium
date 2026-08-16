import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { Redis } from "ioredis";
import { forgeConfig } from "../shared/config.js";
import { loadForgeFromManifest, type LoadedForge, type CollegiumManifest } from "../shared/manifest.js";
import {
  OUTBOUND_STREAM,
  commissionQueueName,
  flattenPayload,
} from "../shared/redis.js";
import type { CommissionPayload } from "../shared/types.js";

function textParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function artifactName(params: Record<string, unknown>): string {
  const requested = textParam(params, "filename") || `artifact-${randomUUID()}.md`;
  const safe = basename(requested).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return safe.endsWith(".md") || safe.endsWith(".txt") ? safe : `${safe}.md`;
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

export class ForgeWorker {
  private readonly queue: string;

  private constructor(
    private readonly redis: Redis,
    private readonly manifest: CollegiumManifest,
    private readonly forge: LoadedForge,
    private readonly workspace: string,
  ) {
    this.queue = commissionQueueName(manifest.channel_id);
  }

  static async create(redis: Redis): Promise<ForgeWorker> {
    const config = forgeConfig();
    const { manifest, forge } = await loadForgeFromManifest(
      config.COLLEGIUM_MANIFEST,
      config.FORGE_NAME,
    );
    return new ForgeWorker(redis, manifest, forge, config.FORGE_WORKSPACE);
  }

  async run(): Promise<void> {
    console.log(`Forge "${this.forge.name}" waiting on ${this.queue}`);
    for (;;) {
      const result = await this.redis.brpop(this.queue, 0);
      if (!result) {
        continue;
      }
      const [, raw] = result;
      try {
        await this.handleCommission(raw);
      } catch (error) {
        console.error("Forge commission failed", error);
      }
    }
  }

  private async handleCommission(raw: string): Promise<void> {
    const commission = JSON.parse(raw) as CommissionPayload;
    const channelId =
      typeof commission.channel_id === "string" ? commission.channel_id : this.manifest.channel_id;
    const threadTs = typeof commission.thread_ts === "string" ? commission.thread_ts : "";

    if (!threadTs) {
      console.warn("Skipping commission without thread_ts", commission);
      return;
    }

    if (commission.forge !== this.forge.name) {
      await this.redis.xadd(
        OUTBOUND_STREAM,
        "*",
        ...flattenPayload({
          channel_id: channelId,
          thread_ts: threadTs,
          text: `Forge refused commission: forge "${String(commission.forge || "")}" is not declared for this worker.`,
        }),
      );
      return;
    }

    const resultText = await this.recordArtifact(commission);
    const artifacts = await listArtifacts(this.workspace);
    const artifactText = artifacts.length ? `\nArtifacts: ${artifacts.join(", ")}` : "";

    await this.redis.xadd(
      OUTBOUND_STREAM,
      "*",
      ...flattenPayload({
        channel_id: channelId,
        thread_ts: threadTs,
        text: `${resultText}${artifactText}`,
      }),
    );
  }

  private async recordArtifact(commission: CommissionPayload): Promise<string> {
    const params = commission.params || {};
    const title = textParam(params, "title") || "Commission Artifact";
    const body =
      textParam(params, "body") ||
      commission.requirements ||
      commission.description ||
      JSON.stringify(commission.params || commission, null, 2);
    const criteria = Array.isArray(commission.acceptance_criteria)
      ? commission.acceptance_criteria.filter((item): item is string => typeof item === "string")
      : [];

    await mkdir(this.workspace, { recursive: true });
    const filename = artifactName(params);
    const artifactPath = join(this.workspace, filename);
    const skillNote = this.forge.skills.length
      ? `\n\nForge skill context loaded: ${this.forge.skill_files.join(", ")}`
      : "";
    const content = [
      `# ${title}`,
      "",
      body,
      criteria.length ? "\n## Acceptance Criteria\n" : "",
      ...criteria.map((criterion) => `- ${criterion}`),
      skillNote,
      "",
    ].join("\n");

    await writeFile(artifactPath, content, "utf8");
    return `Forge "${this.forge.name}" recorded artifact ${filename}.`;
  }
}
