import {
  ToolRegistry,
  createShortcutModule,
  createGitHubModule,
  createNotionModule,
  createSlackDataModule,
} from "@mission-control/integrations";
import type { TimeRange } from "@mission-control/integrations";

let _registry: ToolRegistry | null = null;

/** Singleton registry for server-side use */
export function getRegistry(): ToolRegistry {
  if (!_registry) {
    _registry = new ToolRegistry();
    _registry.register(createShortcutModule());
    _registry.register(createGitHubModule());
    _registry.register(createNotionModule());
    _registry.register(createSlackDataModule());
  }
  return _registry;
}

export function getTimeRange(range: string): TimeRange {
  const now = new Date();
  const until = now.toISOString().split("T")[0];

  switch (range) {
    case "day": {
      const since = new Date(now);
      since.setDate(since.getDate() - 1);
      return { since: since.toISOString().split("T")[0], until };
    }
    case "week": {
      const since = new Date(now);
      since.setDate(since.getDate() - 7);
      return { since: since.toISOString().split("T")[0], until };
    }
    case "month":
    default: {
      const since = new Date(now);
      since.setMonth(since.getMonth() - 1);
      return { since: since.toISOString().split("T")[0], until };
    }
  }
}
