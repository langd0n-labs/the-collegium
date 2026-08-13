import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type RatificationAction = "ratify" | "reject" | "return";

export interface Recommendation {
  eventId: string;
  requestedRatifier: string;
  sourceThread: string;
  outcome: string;
  requirements: string[];
  acceptanceCriteria: string[];
}

export interface RatificationEvent {
  eventId: string;
  recommendationEventId: string;
  signer: string;
  action: RatificationAction;
  returnReason?: string;
}

export interface SignatureVerifier {
  verify(event: RatificationEvent): Promise<boolean>;
}

export interface RecommendationReader {
  get(eventId: string): Promise<Recommendation | undefined>;
}

export interface IssuePublisher {
  findByCommissionId(commissionId: string): Promise<string | undefined>;
  create(input: { title: string; bodyFile: string; commissionId: string }): Promise<string>;
}

export interface ThreadWriter {
  post(thread: string, message: string): Promise<void>;
}

// `null` is a durable pre-effect marker; a URL is a completed delivery. No
// recommendation or GitHub work-state is copied into this file.
type Outbox = Record<string, string | null>;

export interface BridgeResult {
  status: "ignored" | "rejected" | "returned" | "rejected_by_human" | "delivered" | "duplicate";
  commissionId?: string;
  issueUrl?: string;
  reason?: string;
}

/**
 * Deliberately narrow Experiment 0001 adapter. It reads recommendations from
 * Buzz and persists only delivery state. It never owns recommendation status
 * or implementation status.
 */
export class CommissionBridge {
  constructor(
    private readonly recommendations: RecommendationReader,
    private readonly signatures: SignatureVerifier,
    private readonly publisher: IssuePublisher,
    private readonly threads: ThreadWriter,
    private readonly outboxFile: string,
    private readonly bodiesDirectory: string,
  ) {}

  async handle(event: RatificationEvent): Promise<BridgeResult> {
    const recommendation = await this.recommendations.get(event.recommendationEventId);
    if (!recommendation) {
      return { status: "rejected", reason: "recommendation not found" };
    }
    if (!await this.signatures.verify(event) || event.signer !== recommendation.requestedRatifier) {
      await this.threads.post(recommendation.sourceThread, "Ratification rejected: signer is not the requested ratifier.");
      return { status: "rejected", reason: "unauthorized signer" };
    }
    if (event.action === "return") {
      await this.threads.post(recommendation.sourceThread, `Returned to deliberation: ${event.returnReason ?? "no reason supplied"}`);
      return { status: "returned" };
    }
    if (event.action === "reject") {
      await this.threads.post(recommendation.sourceThread, "Recommendation rejected by the authorized human ratifier.");
      return { status: "rejected_by_human" };
    }

    const commissionId = commissionIdFor(event.eventId);
    const outbox = await this.readOutbox();
    const existing = outbox[commissionId];
    if (typeof existing === "string") {
      return { status: "duplicate", commissionId, issueUrl: existing };
    }

    // The outbox comes before any external write. On a restart, a pending
    // record is reconciled by Commission-ID rather than creating a duplicate.
    if (existing === undefined) {
      outbox[commissionId] = null;
      await this.writeOutbox(outbox);
    }

    const bodyFile = await this.writeIssueBody(commissionId, recommendation, event);
    const recovered = await this.publisher.findByCommissionId(commissionId);
    const issueUrl = recovered ?? await this.publisher.create({
      title: recommendation.outcome,
      bodyFile,
      commissionId,
    });
    outbox[commissionId] = issueUrl;
    await this.writeOutbox(outbox);
    await this.threads.post(recommendation.sourceThread, `Commission ${commissionId} created: ${issueUrl}`);
    return { status: "delivered", commissionId, issueUrl };
  }

  private async readOutbox(): Promise<Outbox> {
    try {
      return JSON.parse(await readFile(this.outboxFile, "utf8")) as Outbox;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeOutbox(outbox: Outbox): Promise<void> {
    await mkdir(dirname(this.outboxFile), { recursive: true });
    const temporary = `${this.outboxFile}.tmp`;
    await writeFile(temporary, `${JSON.stringify(outbox, null, 2)}\n`, "utf8");
    await rename(temporary, this.outboxFile);
  }

  private async writeIssueBody(commissionId: string, recommendation: Recommendation, event: RatificationEvent): Promise<string> {
    await mkdir(this.bodiesDirectory, { recursive: true });
    const body = [
      `Commission-ID: ${commissionId}`,
      `Recommendation event: ${recommendation.eventId}`,
      `Ratification event: ${event.eventId}`,
      "Recommended by: experimental Rapporteur",
      `Ratified by: ${event.signer}`,
      "Authority basis: explicit signed human ratification",
      "",
      "## Requested outcome",
      recommendation.outcome,
      "",
      "## Requirements",
      ...recommendation.requirements.map((item) => `- ${item}`),
      "",
      "## Acceptance criteria",
      ...recommendation.acceptanceCriteria.map((item) => `- ${item}`),
      "",
      "## Acceptance authority",
      "Configured human acceptance authority",
      "",
      "## Source thread",
      recommendation.sourceThread,
      "",
    ].join("\n");
    const bodyFile = join(this.bodiesDirectory, `${commissionId}.md`);
    await writeFile(bodyFile, body, "utf8");
    return bodyFile;
  }
}

export function commissionIdFor(ratificationEventId: string): string {
  return `commission-${createHash("sha256").update(ratificationEventId).digest("hex").slice(0, 20)}`;
}
