import type { ShortcutClient } from "./client.js";
import type { TimeRange, ActivityEvent } from "../types.js";

/** Creates dashboard read functions bound to a ShortcutClient instance */
export function createReads(client: ShortcutClient) {
  return {
    async getActivityFeed(range: TimeRange): Promise<ActivityEvent[]> {
      const result = (await client.searchStories(
        `updated:${range.since}..${range.until}`
      )) as { data?: Array<Record<string, unknown>> };

      if (!result?.data) return [];

      return result.data.map((story) => ({
        id: String(story.id),
        source: "shortcut",
        type: `story_${story.story_type ?? "unknown"}`,
        title: String(story.name ?? ""),
        description: String(story.description ?? ""),
        actor: Array.isArray(story.owner_ids)
          ? String(story.owner_ids[0] ?? "unknown")
          : "unknown",
        timestamp: String(story.updated_at ?? ""),
        url: String(
          story.app_url ?? `https://app.shortcut.com/story/${story.id}`
        ),
        metadata: {
          storyType: story.story_type,
          workflowStateId: story.workflow_state_id,
          estimate: story.estimate,
        },
      }));
    },

    async getSummaryMetrics(
      range: TimeRange
    ): Promise<Record<string, number>> {
      const [created, completed] = await Promise.all([
        client.searchStories(
          `created:${range.since}..${range.until}`
        ) as Promise<{ data?: unknown[] }>,
        client.searchStories(
          `completed:${range.since}..${range.until}`
        ) as Promise<{ data?: unknown[] }>,
      ]);

      return {
        stories_created: created?.data?.length ?? 0,
        stories_completed: completed?.data?.length ?? 0,
      };
    },
  };
}
