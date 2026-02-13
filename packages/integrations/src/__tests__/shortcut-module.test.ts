import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createShortcutModule } from "../shortcut/index.js";

describe("Shortcut IntegrationModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports unconfigured when SHORTCUT_API_TOKEN is missing", () => {
    delete process.env.SHORTCUT_API_TOKEN;
    const mod = createShortcutModule();
    expect(mod.isConfigured()).toBe(false);
  });

  it("reports configured when SHORTCUT_API_TOKEN is set", () => {
    process.env.SHORTCUT_API_TOKEN = "test-token";
    const mod = createShortcutModule();
    expect(mod.isConfigured()).toBe(true);
  });

  it("has the correct module name", () => {
    const mod = createShortcutModule();
    expect(mod.name).toBe("shortcut");
  });

  it("has a non-empty description", () => {
    const mod = createShortcutModule();
    expect(mod.description.length).toBeGreaterThan(0);
  });

  it("exposes tools without prefix (registry adds prefix)", () => {
    const mod = createShortcutModule();
    const toolNames = mod.tools.map((t) => t.name);

    expect(toolNames).toContain("create_story");
    expect(toolNames).toContain("update_story");
    expect(toolNames).toContain("get_story");
    expect(toolNames).toContain("search_stories");
    expect(toolNames).toContain("add_comment");
    expect(toolNames).toContain("list_members");
    expect(toolNames).toContain("list_workflow_states");
    expect(toolNames).toContain("list_labels");
    expect(toolNames).toContain("list_projects");

    // None should be prefixed
    for (const name of toolNames) {
      expect(name).not.toMatch(/^shortcut_/);
    }
  });

  it("has 9 tools total", () => {
    const mod = createShortcutModule();
    expect(mod.tools).toHaveLength(9);
  });

  it("returns error from executeTool when unconfigured", async () => {
    delete process.env.SHORTCUT_API_TOKEN;
    const mod = createShortcutModule();
    const result = await mod.executeTool("create_story", { name: "Test" });
    expect(JSON.parse(result)).toEqual({
      error: "Shortcut not configured",
    });
  });

  it("returns empty activity feed when unconfigured", async () => {
    delete process.env.SHORTCUT_API_TOKEN;
    const mod = createShortcutModule();
    const feed = await mod.getActivityFeed({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(feed).toEqual([]);
  });

  it("returns empty metrics when unconfigured", async () => {
    delete process.env.SHORTCUT_API_TOKEN;
    const mod = createShortcutModule();
    const metrics = await mod.getSummaryMetrics({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(metrics).toEqual({});
  });

  it("returns empty alerts when unconfigured", async () => {
    delete process.env.SHORTCUT_API_TOKEN;
    const mod = createShortcutModule();
    const alerts = await mod.getAlerts!({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(alerts).toEqual([]);
  });
});
