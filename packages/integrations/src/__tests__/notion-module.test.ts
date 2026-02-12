import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createNotionModule } from "../notion/index.js";

describe("Notion IntegrationModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports unconfigured when NOTION_TOKEN is missing", () => {
    delete process.env.NOTION_TOKEN;
    const mod = createNotionModule();
    expect(mod.isConfigured()).toBe(false);
  });

  it("reports configured when NOTION_TOKEN is set", () => {
    process.env.NOTION_TOKEN = "ntn_test";
    const mod = createNotionModule();
    expect(mod.isConfigured()).toBe(true);
  });

  it("has the correct module name", () => {
    const mod = createNotionModule();
    expect(mod.name).toBe("notion");
  });

  it("exposes 3 tools without prefix", () => {
    const mod = createNotionModule();
    const toolNames = mod.tools.map((t) => t.name);
    expect(toolNames).toEqual(["search", "get_page", "query_database"]);
    for (const name of toolNames) {
      expect(name).not.toMatch(/^notion_/);
    }
  });

  it("returns error from executeTool when unconfigured", async () => {
    delete process.env.NOTION_TOKEN;
    const mod = createNotionModule();
    const result = await mod.executeTool("search", { query: "test" });
    expect(JSON.parse(result)).toEqual({ error: "Notion not configured" });
  });

  it("integrates with ToolRegistry correctly", async () => {
    process.env.NOTION_TOKEN = "ntn_test";
    const { ToolRegistry } = await import("../registry.js");
    const registry = new ToolRegistry();
    registry.register(createNotionModule());
    const tools = registry.getTools();
    expect(tools.map((t) => t.name)).toEqual([
      "notion_search",
      "notion_get_page",
      "notion_query_database",
    ]);
  });
});
