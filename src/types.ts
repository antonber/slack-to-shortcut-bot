export interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  files?: { name: string; mimetype: string }[];
}

export interface ShortcutTicket {
  name: string;
  description: string;
  story_type: "feature" | "bug" | "chore";
  labels: string[];
  estimate: number | null;
}

export interface AppMentionEvent {
  type: "app_mention";
  user: string;
  text: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  event_ts: string;
}
