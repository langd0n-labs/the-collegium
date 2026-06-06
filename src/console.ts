import { createInterface } from "node:readline";
import { appendFile, open } from "node:fs/promises";
import "dotenv/config";

const inputFile = process.env["INGRESS_FILE"];
const egressFile = process.env["EGRESS_FILE"];

if (!inputFile) {
  console.error("INGRESS_FILE environment variable is required");
  process.exit(1);
}
if (!egressFile) {
  console.error("EGRESS_FILE environment variable is required");
  process.exit(1);
}

const channelId = process.env["CONSOLE_CHANNEL_ID"] || "console";
const threadTs = process.env["CONSOLE_THREAD_TS"] || String(Date.now() / 1000);

async function tailEgress(file: string): Promise<void> {
  let offset = 0;
  for (;;) {
    try {
      const fd = await open(file, "r");
      try {
        const { size } = await fd.stat();
        if (size > offset) {
          const buf = Buffer.alloc(size - offset);
          await fd.read(buf, 0, buf.length, offset);
          offset = size;
          process.stdout.write(buf.toString("utf8"));
        }
      } finally {
        await fd.close();
      }
    } catch {
      // file may not exist yet
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  }
}

tailEgress(egressFile).catch(console.error);

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
rl.prompt();

rl.on("line", async (input: string) => {
  const text = input.trim();
  if (!text) {
    rl.prompt();
    return;
  }
  const msg = {
    channel_id: channelId,
    thread_ts: threadTs,
    user: "console",
    text,
    ts: String(Date.now() / 1000),
  };
  await appendFile(inputFile!, JSON.stringify(msg) + "\n", "utf8");
  rl.prompt();
});

rl.on("close", () => {
  process.exit(0);
});
