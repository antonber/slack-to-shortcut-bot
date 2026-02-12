import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSlackDataModule } from "../slack-data/index.js";

describe("Slack Data IntegrationModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports unconfigured when SLACK_BOT_TOKEN is missing", () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_DATA_ENABLED;
    const mod = createSlackDataModule();
    expect(mod.isConfigured()).toBe(false);
  });

  it("reports unconfigured when SLACK_DATA_ENABLED is not set", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    delete process.env.SLACK_DATA_ENABLED;
    const mod = createSlackDataModule();
    expect(mod.isConfigured()).toBe(false);
  });

  it("reports configured when both token and enabled flag are set", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_DATA_ENABLED = "true";
    const mod = createSlackDataModule();
    expect(mod.isConfigured()).toBe(true);
  });

  it("has the correct module name", () => {
    const mod = createSlackDataModule();
    expect(mod.name).toBe("slack_data");
  });

  it("exposes 2 tools without prefix", () => {
    const mod = createSlackDataModule();
    const toolNames = mod.tools.map((t) => t.name);
    expect(toolNames).toEqual(["search_messages", "get_channel_history"]);
  });

  it("returns error from executeTool when unconfigured", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const mod = createSlackDataModule();
    const result = await mod.executeTool("search_messages", {
      query: "test",
    });
    expect(JSON.parse(result)).toEqual({
      error: "Slack data not configured",
    });
  });

  it("integrates with ToolRegistry correctly", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_DATA_ENABLED = "true";
    const { ToolRegistry } = await import("../registry.js");
    const registry = new ToolRegistry();
    registry.register(createSlackDataModule());
    const tools = registry.getTools();
    expect(tools.map((t) => t.name)).toEqual([
      "slack_data_search_messages",
      "slack_data_get_channel_history",
    ]);
  });
});
