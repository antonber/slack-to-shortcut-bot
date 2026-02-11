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

export interface ReactionAddedEvent {
  type: "reaction_added";
  user: string;
  reaction: string;
  item: {
    type: "message";
    channel: string;
    ts: string;
  };
  event_ts: string;
}
