import type { IntegrationModule } from "../types.js";
import { loadGitHubConfig } from "./config.js";
import { GitHubClient } from "./client.js";
import { TOOLS, createExecutor } from "./tools.js";
import { createReads } from "./reads.js";

export function createGitHubModule(): IntegrationModule {
  const config = loadGitHubConfig();
  const client = config ? new GitHubClient(config) : null;
  const reads = client ? createReads(client) : null;
  const executor = client
    ? createExecutor(client)
    : async () => JSON.stringify({ error: "GitHub not configured" });

  return {
    name: "github",
    description:
      "GitHub — list and search pull requests, issues, and commits across configured repositories.",
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
