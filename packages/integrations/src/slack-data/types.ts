export interface SlackSearchResult {
  channel: string;
  channel_name: string;
  user: string;
  text: string;
  ts: string;
  permalink: string;
}

export interface SlackChannelMessage {
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}
