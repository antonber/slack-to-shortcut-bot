import type { IntegrationModule } from "../types.js";
import { loadSlackDataConfig } from "./config.js";
import { SlackDataClient } from "./client.js";
import { TOOLS, createExecutor } from "./tools.js";
import { createReads } from "./reads.js";

export function createSlackDataModule(): IntegrationModule {
  const config = loadSlackDataConfig();
  const client = config ? new SlackDataClient(config) : null;
  const reads = client ? createReads(client) : null;
  const executor = client
    ? createExecutor(client)
    : async () =>
        JSON.stringify({ error: "Slack data not configured" });

  return {
    name: "slack_data",
    description:
      "Slack — search messages across channels and view channel history.",
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
