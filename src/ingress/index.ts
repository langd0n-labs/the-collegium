import { ingressConfig } from "../shared/config.js";
import {
  OUTBOUND_STREAM,
  appendThreadHistory,
  createRedis,
  flattenPayload,
  hydratePayload,
  streamName,
} from "../shared/redis.js";
import type { Ingress, Egress } from "./port.js";

const config = ingressConfig();
const redis = createRedis();

async function buildAdapters(): Promise<{ ingress: Ingress; egress: Egress }> {
  if (config.INGRESS_MODE === "file") {
    const { FileIngress, FileEgress } = await import("./adapters/file.js");
    if (!config.INGRESS_FILE) throw new Error("INGRESS_FILE is required when INGRESS_MODE=file");
    if (!config.EGRESS_FILE) throw new Error("EGRESS_FILE is required when INGRESS_MODE=file");
    return {
      ingress: new FileIngress(config.INGRESS_FILE, config.FILE_INGRESS_MODE),
      egress: new FileEgress(config.EGRESS_FILE),
    };
  }

  const { createSlackAdapters } = await import("./adapters/slack.js");
  if (!config.SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN is required when INGRESS_MODE=slack");
  if (!config.SLACK_APP_TOKEN) throw new Error("SLACK_APP_TOKEN is required when INGRESS_MODE=slack");
  return createSlackAdapters({
    botToken: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
  });
}

async function outboundLoop(egress: Egress): Promise<void> {
  let lastId = "$";

  for (;;) {
    const result = await redis.xread("BLOCK", 5000, "STREAMS", OUTBOUND_STREAM, lastId);
    if (!result) {
      continue;
    }

    for (const [, messages] of result) {
      for (const [id, fields] of messages) {
        lastId = id;
        const payload = hydratePayload(fields);
        const channel_id = payload["channel_id"];
        const thread_ts = payload["thread_ts"];
        const text = payload["text"];

        if (!channel_id || !thread_ts || !text) {
          console.warn("Skipping malformed outbound payload", payload);
          continue;
        }

        await egress.send({ channel_id, thread_ts, text });
      }
    }
  }
}

async function main(): Promise<void> {
  const { ingress, egress } = await buildAdapters();

  await ingress.start(async (msg) => {
    const streamPayload = {
      channel_id: msg.channel_id,
      thread_ts: msg.thread_ts,
      user: msg.user,
      text: msg.text,
      ...(msg.ts ? { ts: msg.ts } : {}),
    };
    await redis.xadd(streamName(msg.channel_id), "*", ...flattenPayload(streamPayload));
    await appendThreadHistory(redis, msg);
  });

  if (config.INGRESS_MODE === "file" && config.FILE_INGRESS_MODE === "replay") {
    // After replay drains, wait for deliberation to settle then exit
    const { FileIngress } = await import("./adapters/file.js");
    const fileIngress = ingress as InstanceType<typeof FileIngress>;

    await fileIngress.drained;
    console.log("Replay drained — waiting for deliberation to settle…");

    // Wait for OUTBOUND_STREAM to go quiet for REPLAY_SETTLE_MS
    let lastOutboundId = "$";
    let quiescentSince = Date.now();

    while (Date.now() - quiescentSince < config.REPLAY_SETTLE_MS) {
      const result = await redis.xread(
        "BLOCK",
        Math.min(1000, config.REPLAY_SETTLE_MS),
        "STREAMS",
        OUTBOUND_STREAM,
        lastOutboundId,
      );
      if (result) {
        quiescentSince = Date.now();
        for (const [, messages] of result) {
          for (const [id, fields] of messages) {
            lastOutboundId = id;
            const payload = hydratePayload(fields);
            const channel_id = payload["channel_id"];
            const thread_ts = payload["thread_ts"];
            const text = payload["text"];
            if (channel_id && thread_ts && text) {
              await egress.send({ channel_id, thread_ts, text });
            }
          }
        }
      }
    }

    console.log("Deliberation settled. Exiting.");
    await egress.stop();
    await ingress.stop();
    redis.disconnect();
    process.exit(0);
  }

  await outboundLoop(egress);
}

main().catch((error) => {
  console.error("Ingress Engine failed", error);
  process.exit(1);
});
