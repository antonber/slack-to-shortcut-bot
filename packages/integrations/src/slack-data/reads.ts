import type { SlackDataClient } from "./client.js";
import type { TimeRange, ActivityEvent } from "../types.js";

/** Creates dashboard read functions bound to a SlackDataClient instance */
export function createReads(client: SlackDataClient) {
  return {
    async getActivityFeed(range: TimeRange): Promise<ActivityEvent[]> {
      const results = await client.searchMessages(
        `after:${range.since} before:${range.until}`,
        { count: 50 }
      );

      return results.map((msg) => ({
        id: `slack-${msg.channel}-${msg.ts}`,
        source: "slack",
        type: "message",
        title: msg.text.slice(0, 100) + (msg.text.length > 100 ? "..." : ""),
        description: `in #${msg.channel_name}`,
        actor: msg.user,
        timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
        url: msg.permalink,
        metadata: { channel: msg.channel, channel_name: msg.channel_name },
      }));
    },

    async getSummaryMetrics(
      range: TimeRange
    ): Promise<Record<string, number>> {
      const results = await client.searchMessages(
        `after:${range.since} before:${range.until}`,
        { count: 1 }
      );

      // Slack search returns total count in pagination info
      // For a rough count, use the results length as a lower bound
      return {
        messages_found: results.length,
      };
    },
  };
}
