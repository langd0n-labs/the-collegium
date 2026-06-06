import type { CollegiumMessage, OutboundMessage } from "../shared/types.js";

export interface Ingress {
  start(onMessage: (msg: CollegiumMessage) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}

export interface Egress {
  send(msg: OutboundMessage): Promise<void>;
  stop(): Promise<void>;
}
