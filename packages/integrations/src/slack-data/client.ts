import { WebClient } from "@slack/web-api";
import type { SlackDataConfig } from "./config.js";
import type { SlackSearchResult, SlackChannelMessage } from "./types.js";

export class SlackDataClient {
  private slack: WebClient;

  constructor(config: SlackDataConfig) {
    this.slack = new WebClient(config.token);
  }

  async searchMessages(
    query: string,
    options: { count?: number } = {}
  ): Promise<SlackSearchResult[]> {
    const { count = 20 } = options;

    const result = await this.slack.search.messages({
      query,
      count,
      sort: "timestamp",
      sort_dir: "desc",
    });

    const matches =
      (result.messages as { matches?: Array<Record<string, unknown>> })
        ?.matches ?? [];

    return matches.map((m) => ({
      channel: (m.channel as { id?: string })?.id ?? "",
      channel_name: (m.channel as { name?: string })?.name ?? "",
      user: (m.user as string) ?? (m.username as string) ?? "unknown",
      text: (m.text as string) ?? "",
      ts: (m.ts as string) ?? "",
      permalink: (m.permalink as string) ?? "",
    }));
  }

  async getChannelHistory(
    channel: string,
    options: { limit?: number; oldest?: string; latest?: string } = {}
  ): Promise<SlackChannelMessage[]> {
    const { limit = 50, oldest, latest } = options;

    const result = await this.slack.conversations.history({
      channel,
      limit,
      oldest,
      latest,
    });

    return (result.messages ?? []).map((m) => ({
      user: m.user ?? "unknown",
      text: m.text ?? "",
      ts: m.ts ?? "",
      thread_ts: m.thread_ts,
      reply_count: m.reply_count,
    }));
  }
}
