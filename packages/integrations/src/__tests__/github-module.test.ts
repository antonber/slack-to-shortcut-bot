import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGitHubModule } from "../github/index.js";

describe("GitHub IntegrationModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports unconfigured when GITHUB_TOKEN is missing", () => {
    delete process.env.GITHUB_TOKEN;
    const mod = createGitHubModule();
    expect(mod.isConfigured()).toBe(false);
  });

  it("reports configured when GITHUB_TOKEN is set", () => {
    process.env.GITHUB_TOKEN = "ghp_test";
    const mod = createGitHubModule();
    expect(mod.isConfigured()).toBe(true);
  });

  it("has the correct module name", () => {
    const mod = createGitHubModule();
    expect(mod.name).toBe("github");
  });

  it("has a non-empty description", () => {
    const mod = createGitHubModule();
    expect(mod.description.length).toBeGreaterThan(0);
  });

  it("exposes tools without prefix", () => {
    const mod = createGitHubModule();
    const toolNames = mod.tools.map((t) => t.name);

    expect(toolNames).toContain("list_prs");
    expect(toolNames).toContain("get_pr");
    expect(toolNames).toContain("list_issues");
    expect(toolNames).toContain("search_issues");
    expect(toolNames).toContain("recent_commits");

    for (const name of toolNames) {
      expect(name).not.toMatch(/^github_/);
    }
  });

  it("has 5 tools", () => {
    const mod = createGitHubModule();
    expect(mod.tools).toHaveLength(5);
  });

  it("returns error from executeTool when unconfigured", async () => {
    delete process.env.GITHUB_TOKEN;
    const mod = createGitHubModule();
    const result = await mod.executeTool("list_prs", {});
    expect(JSON.parse(result)).toEqual({
      error: "GitHub not configured",
    });
  });

  it("returns empty activity feed when unconfigured", async () => {
    delete process.env.GITHUB_TOKEN;
    const mod = createGitHubModule();
    const feed = await mod.getActivityFeed({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(feed).toEqual([]);
  });

  it("returns empty metrics when unconfigured", async () => {
    delete process.env.GITHUB_TOKEN;
    const mod = createGitHubModule();
    const metrics = await mod.getSummaryMetrics({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(metrics).toEqual({});
  });

  it("integrates with ToolRegistry correctly", async () => {
    process.env.GITHUB_TOKEN = "ghp_test";
    const { ToolRegistry } = await import("../registry.js");
    const registry = new ToolRegistry();
    registry.register(createGitHubModule());

    const tools = registry.getTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("github_list_prs");
    expect(toolNames).toContain("github_get_pr");
    expect(toolNames).toContain("github_list_issues");
    expect(toolNames).toContain("github_search_issues");
    expect(toolNames).toContain("github_recent_commits");
  });
});
