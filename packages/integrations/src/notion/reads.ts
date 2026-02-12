import type { NotionClient } from "./client.js";
import type { TimeRange, ActivityEvent } from "../types.js";

/** Creates dashboard read functions bound to a NotionClient instance */
export function createReads(client: NotionClient) {
  return {
    async getActivityFeed(range: TimeRange): Promise<ActivityEvent[]> {
      const pages = await client.recentlyEdited(range.since);

      return pages
        .filter(
          (p) =>
            new Date(p.last_edited_time) <= new Date(range.until)
        )
        .map((page) => ({
          id: `notion-${page.id}`,
          source: "notion",
          type: "page_edited",
          title: page.title,
          description: `Page updated`,
          actor: "unknown",
          timestamp: page.last_edited_time,
          url: page.url,
          metadata: { pageType: page.type },
        }));
    },

    async getSummaryMetrics(
      range: TimeRange
    ): Promise<Record<string, number>> {
      const pages = await client.recentlyEdited(range.since);
      const inRange = pages.filter(
        (p) =>
          new Date(p.last_edited_time) <= new Date(range.until)
      );

      return {
        pages_updated: inRange.length,
      };
    },
  };
}
