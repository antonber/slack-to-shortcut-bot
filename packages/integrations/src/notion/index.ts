import type { IntegrationModule } from "../types.js";
import { loadNotionConfig } from "./config.js";
import { NotionClient } from "./client.js";
import { TOOLS, createExecutor } from "./tools.js";
import { createReads } from "./reads.js";

export function createNotionModule(): IntegrationModule {
  const config = loadNotionConfig();
  const client = config ? new NotionClient(config) : null;
  const reads = client ? createReads(client) : null;
  const executor = client
    ? createExecutor(client)
    : async () => JSON.stringify({ error: "Notion not configured" });

  return {
    name: "notion",
    description:
      "Notion — search pages, view page properties, and query databases.",
    isConfigured: () => config !== null,
    tools: TOOLS,
    executeTool: executor,
    getActivityFeed: reads
      ? (range) => reads.getActivityFeed(range)
      : async () => [],
    getSummaryMetrics: reads
      ? (range) => reads.getSummaryMetrics(range)
      : async () => ({}),
  };
}
