import { App } from "@slack/bolt";
import type { GenericMessageEvent } from "@slack/bolt";
import { ingressConfig } from "../shared/config.js";
import {
  OUTBOUND_STREAM,
  createRedis,
  flattenPayload,
  hydratePayload,
  streamName,
} from "../shared/redis.js";

const config = ingressConfig();
const redis = createRedis();

const app = new App({
  token: config.SLACK_BOT_TOKEN,
  appToken: config.SLACK_APP_TOKEN,
  socketMode: true,
});

app.message(async ({ message }) => {
  const slackMessage = message as GenericMessageEvent;

  if (!slackMessage.channel || !slackMessage.user || !slackMessage.text || !slackMessage.ts) {
    return;
  }

  const threadTs = slackMessage.thread_ts || slackMessage.ts;
  await redis.xadd(
    streamName(slackMessage.channel),
    "*",
    ...flattenPayload({
      channel_id: slackMessage.channel,
      thread_ts: threadTs,
      user: slackMessage.user,
      text: slackMessage.text,
      ts: slackMessage.ts,
    }),
  );
});

async function outboundLoop(): Promise<void> {
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
        const channel = payload.channel_id;
        const threadTs = payload.thread_ts;
        const text = payload.text;

        if (!channel || !threadTs || !text) {
          console.warn("Skipping malformed outbound payload", payload);
          continue;
        }

        await app.client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text,
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await app.start();
  console.log("Ingress Engine is connected to Slack Socket Mode.");
  await outboundLoop();
}

main().catch((error) => {
  console.error("Ingress Engine failed", error);
  process.exit(1);
});
