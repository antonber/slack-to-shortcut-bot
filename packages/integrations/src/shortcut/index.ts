import type { IntegrationModule } from "../types.js";
import { loadShortcutConfig } from "./config.js";
import { ShortcutClient } from "./client.js";
import { TOOLS, createExecutor } from "./tools.js";
import { createReads } from "./reads.js";

export function createShortcutModule(): IntegrationModule {
  const config = loadShortcutConfig();
  const client = config ? new ShortcutClient(config) : null;
  const reads = client && config ? createReads(client, config) : null;
  const executor = client
    ? createExecutor(client)
    : async () => JSON.stringify({ error: "Shortcut not configured" });

  return {
    name: "shortcut",
    description:
      "Shortcut project management — create, update, search stories; manage workflows, members, labels, and projects.",
    isConfigured: () => config !== null,
    tools: TOOLS,
    executeTool: executor,
    getActivityFeed: reads
      ? (range) => reads.getActivityFeed(range)
      : async () => [],
    getSummaryMetrics: reads
      ? (range) => reads.getSummaryMetrics(range)
      : async () => ({}),
    getAlerts: reads
      ? (range) => reads.getAlerts(range)
      : async () => [],
  };
}
