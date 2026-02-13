import type { ShortcutClient } from "./client.js";
import type { ShortcutConfig } from "./config.js";
import type { TimeRange, ActivityEvent, Alert } from "../types.js";

interface WorkflowState {
  id: number;
  name: string;
  type: string;
}

interface StoryRecord {
  id: number;
  name?: string;
  description?: string;
  story_type?: string;
  owner_ids?: string[];
  updated_at?: string;
  app_url?: string;
  workflow_state_id?: number;
  estimate?: number | null;
}

interface ActiveStoriesResult {
  activeStates: WorkflowState[];
  storiesByState: Map<string, StoryRecord[]>;
  allActiveStories: StoryRecord[];
}

/** Fetches workflow states with type "started" and all stories in those states */
async function getActiveStories(
  client: ShortcutClient,
  workflowName?: string
): Promise<ActiveStoriesResult> {
  const workflows = (await client.listWorkflowStates()) as Array<{
    name: string;
    states: WorkflowState[];
  }>;

  // Filter to specific workflow if configured, otherwise use all
  const targetWorkflows = workflowName
    ? workflows.filter((wf) => wf.name === workflowName)
    : workflows;

  const activeStates: WorkflowState[] = [];
  for (const wf of targetWorkflows) {
    for (const state of wf.states) {
      if (state.type === "started") {
        activeStates.push(state);
      }
    }
  }

  const storiesByState = new Map<string, StoryRecord[]>();
  const allActiveStories: StoryRecord[] = [];

  for (const state of activeStates) {
    const result = (await client.searchStories(
      `state:"${state.name}"`
    )) as { data?: StoryRecord[] };
    const stories = result?.data ?? [];
    storiesByState.set(state.name, stories);
    allActiveStories.push(...stories);
  }

  return { activeStates, storiesByState, allActiveStories };
}

/** Creates dashboard read functions bound to a ShortcutClient instance */
export function createReads(client: ShortcutClient, config?: ShortcutConfig) {
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
      const [created, completed, active] = await Promise.all([
        client.searchStories(
          `created:${range.since}..${range.until}`
        ) as Promise<{ data?: unknown[] }>,
        client.searchStories(
          `completed:${range.since}..${range.until}`
        ) as Promise<{ data?: unknown[] }>,
        getActiveStories(client, config?.workflowName),
      ]);

      const now = Date.now();
      const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

      let storiesStuck = 0;
      let storiesUnestimated = 0;
      for (const story of active.allActiveStories) {
        const updatedAt = story.updated_at ? new Date(story.updated_at).getTime() : 0;
        if (now - updatedAt > FIVE_DAYS_MS) storiesStuck++;
        if (story.estimate == null) storiesUnestimated++;
      }

      const metrics: Record<string, number> = {
        stories_created: created?.data?.length ?? 0,
        stories_completed: completed?.data?.length ?? 0,
        stories_stuck: storiesStuck,
        stories_unestimated: storiesUnestimated,
      };

      // Per-state counts
      for (const [stateName, stories] of active.storiesByState) {
        const key = `stories_${stateName.toLowerCase().replace(/\s+/g, "_")}`;
        metrics[key] = stories.length;
      }

      return metrics;
    },

    async getAlerts(range: TimeRange): Promise<Alert[]> {
      const active = await getActiveStories(client, config?.workflowName);
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const alerts: Alert[] = [];

      // Stuck stories: active state + no update in 7+ days
      const stuckStories = active.allActiveStories.filter((s) => {
        const updatedAt = s.updated_at ? new Date(s.updated_at).getTime() : 0;
        return now - updatedAt > SEVEN_DAYS_MS;
      });

      if (stuckStories.length > 0) {
        alerts.push({
          id: "shortcut-stuck-stories",
          source: "shortcut",
          severity: "warning",
          title: `${stuckStories.length} stuck ${stuckStories.length === 1 ? "story" : "stories"}`,
          description: "Stories in active states with no updates for 7+ days",
          items: stuckStories.map((s) => ({
            id: String(s.id),
            title: s.name ?? `Story ${s.id}`,
            url: s.app_url ?? `https://app.shortcut.com/story/${s.id}`,
            metadata: { updatedAt: s.updated_at },
          })),
          timestamp: new Date().toISOString(),
        });
      }

      // Unestimated stories in active states
      const unestimated = active.allActiveStories.filter(
        (s) => s.estimate == null
      );

      if (unestimated.length > 0) {
        alerts.push({
          id: "shortcut-unestimated-stories",
          source: "shortcut",
          severity: "info",
          title: `${unestimated.length} unestimated ${unestimated.length === 1 ? "story" : "stories"}`,
          description: "Stories in active states without point estimates",
          items: unestimated.map((s) => ({
            id: String(s.id),
            title: s.name ?? `Story ${s.id}`,
            url: s.app_url ?? `https://app.shortcut.com/story/${s.id}`,
            metadata: { estimate: s.estimate },
          })),
          timestamp: new Date().toISOString(),
        });
      }

      return alerts;
    },
  };
}
