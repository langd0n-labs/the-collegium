import { appendFile, open, readFile } from "node:fs/promises";
import { watch } from "node:fs/promises";
import type { Ingress, Egress } from "../port.js";
import type { CollegiumMessage, OutboundMessage } from "../../shared/types.js";

export type FileIngressMode = "replay" | "watch";

export class FileIngress implements Ingress {
  private abortController = new AbortController();
  private drainedResolve: (() => void) | undefined;
  readonly drained: Promise<void>;

  constructor(
    private readonly inputFile: string,
    private readonly mode: FileIngressMode,
  ) {
    this.drained = new Promise<void>((resolve) => {
      this.drainedResolve = resolve;
    });
  }

  async start(onMessage: (msg: CollegiumMessage) => Promise<void>): Promise<void> {
    if (this.mode === "replay") {
      await this.replay(onMessage);
      this.drainedResolve?.();
    } else {
      this.watchFile(onMessage).catch((err: unknown) => {
        if (!this.abortController.signal.aborted) {
          console.error("FileIngress watch error", err);
        }
      });
    }
  }

  async stop(): Promise<void> {
    this.abortController.abort();
  }

  private async replay(onMessage: (msg: CollegiumMessage) => Promise<void>): Promise<void> {
    let text: string;
    try {
      text = await readFile(this.inputFile, "utf8");
    } catch {
      return;
    }
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as CollegiumMessage;
        await onMessage(msg);
      } catch {
        console.warn("FileIngress: skipping malformed line");
      }
    }
  }

  private async watchFile(onMessage: (msg: CollegiumMessage) => Promise<void>): Promise<void> {
    const signal = this.abortController.signal;
    let offset = 0;

    const processNew = async (): Promise<void> => {
      try {
        const fd = await open(this.inputFile, "r");
        try {
          const { size } = await fd.stat();
          if (size <= offset) return;
          const buf = Buffer.alloc(size - offset);
          await fd.read(buf, 0, buf.length, offset);
          offset = size;
          const text = buf.toString("utf8");
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const msg = JSON.parse(line) as CollegiumMessage;
              await onMessage(msg);
            } catch {
              console.warn("FileIngress: skipping malformed line");
            }
          }
        } finally {
          await fd.close();
        }
      } catch {
        // file may not exist yet
      }
    };

    // emit any existing content first
    await processNew();

    try {
      const watcher = watch(this.inputFile, { signal });
      for await (const _ of watcher) {
        await processNew();
      }
    } catch (err) {
      if (!signal.aborted) throw err;
    }
  }
}

export class FileEgress implements Egress {
  constructor(private readonly outputFile: string) {}

  async send(msg: OutboundMessage): Promise<void> {
    const line = `[${new Date().toISOString()}] ${msg.text}\n`;
    await appendFile(this.outputFile, line, "utf8");
  }

  async stop(): Promise<void> {
    // no-op
  }
}
