import { App } from "@slack/bolt";
import type { GenericMessageEvent } from "@slack/bolt";
import type { Ingress, Egress } from "../port.js";
import type { CollegiumMessage, OutboundMessage } from "../../shared/types.js";

export function createSlackAdapters(config: {
  botToken: string;
  appToken: string;
}): { ingress: Ingress; egress: Egress } {
  const app = new App({
    token: config.botToken,
    appToken: config.appToken,
    socketMode: true,
  });

  const ingress: Ingress = {
    async start(onMessage: (msg: CollegiumMessage) => Promise<void>): Promise<void> {
      app.message(async ({ message }) => {
        const slackMessage = message as GenericMessageEvent;
        if (
          !slackMessage.channel ||
          !slackMessage.user ||
          !slackMessage.text ||
          !slackMessage.ts
        ) {
          return;
        }
        const threadTs = slackMessage.thread_ts || slackMessage.ts;
        await onMessage({
          channel_id: slackMessage.channel,
          thread_ts: threadTs,
          user: slackMessage.user,
          text: slackMessage.text,
          ts: slackMessage.ts,
        });
      });
      await app.start();
      console.log("Ingress Engine is connected to Slack Socket Mode.");
    },
    async stop(): Promise<void> {
      await app.stop();
    },
  };

  const egress: Egress = {
    async send(msg: OutboundMessage): Promise<void> {
      await app.client.chat.postMessage({
        channel: msg.channel_id,
        thread_ts: msg.thread_ts,
        text: msg.text,
      });
    },
    async stop(): Promise<void> {
      // lifecycle managed by ingress.stop()
    },
  };

  return { ingress, egress };
}
