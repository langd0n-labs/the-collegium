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
  forge?: string;
  params?: Record<string, unknown>;
  description?: string;
  requirements?: string;
  acceptance_criteria?: string[];
  [key: string]: unknown;
}
