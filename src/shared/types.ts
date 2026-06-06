export interface CollegiumMessage {
  channel_id: string;
  thread_ts: string;
  user: string;
  text: string;
  ts?: string;
}

export interface OutboundMessage {
  channel_id: string;
  thread_ts: string;
  text: string;
}

export interface CommissionPayload {
  channel_id?: string;
  thread_ts?: string;
  description?: string;
  capability?: string;
  command?: string;
  [key: string]: unknown;
}
