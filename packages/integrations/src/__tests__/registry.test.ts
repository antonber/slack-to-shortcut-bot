import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "../registry.js";
import type { IntegrationModule } from "../types.js";

function createMockModule(
  overrides: Partial<IntegrationModule> = {}
): IntegrationModule {
  return {
    name: "test",
    description: "Test integration",
    isConfigured: () => true,
    tools: [
      {
        name: "do_thing",
        description: "Does a thing",
        input_schema: { type: "object" as const, properties: {} },
      },
    ],
    executeTool: vi.fn(async () => JSON.stringify({ ok: true })),
    getActivityFeed: vi.fn(async () => []),
    getSummaryMetrics: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe("ToolRegistry", () => {
  it("registers configured modules", () => {
    const registry = new ToolRegistry();
    registry.register(createMockModule());
    expect(registry.getModules()).toHaveLength(1);
  });

  it("skips unconfigured modules", () => {
    const registry = new ToolRegistry();
    registry.register(createMockModule({ isConfigured: () => false }));
    expect(registry.getModules()).toHaveLength(0);
  });

  it("prefixes tool names with module name", () => {
    const registry = new ToolRegistry();
    registry.register(createMockModule({ name: "github" }));
    const tools = registry.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("github_do_thing");
  });

  it("merges tools from multiple modules", () => {
    const registry = new ToolRegistry();
    registry.register(createMockModule({ name: "shortcut" }));
    registry.register(
      createMockModule({
        name: "github",
        tools: [
          {
            name: "list_prs",
            description: "List PRs",
            input_schema: { type: "object" as const, properties: {} },
          },
          {
            name: "get_pr",
            description: "Get PR",
            input_schema: { type: "object" as const, properties: {} },
          },
        ],
      })
    );
    const tools = registry.getTools();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      "shortcut_do_thing",
      "github_list_prs",
      "github_get_pr",
    ]);
  });

  it("dispatches executeTool to the correct module", async () => {
    const executor = vi.fn(async () => '{"result":"ok"}');
    const registry = new ToolRegistry();
    registry.register(
      createMockModule({ name: "shortcut", executeTool: executor })
    );

    await registry.executeTool("shortcut_create_story", { name: "Test" });

    expect(executor).toHaveBeenCalledWith("create_story", { name: "Test" });
  });

  it("returns error for unknown tool prefix", async () => {
    const registry = new ToolRegistry();
    registry.register(createMockModule({ name: "shortcut" }));

    const result = await registry.executeTool("unknown_tool", {});
    expect(JSON.parse(result)).toEqual({ error: "Unknown tool: unknown_tool" });
  });

  it("returns module descriptions", () => {
    const registry = new ToolRegistry();
    registry.register(
      createMockModule({
        name: "shortcut",
        description: "Project management",
      })
    );
    registry.register(
      createMockModule({ name: "github", description: "Code hosting" })
    );

    const descriptions = registry.getModuleDescriptions();
    expect(descriptions).toEqual([
      { name: "shortcut", description: "Project management" },
      { name: "github", description: "Code hosting" },
    ]);
  });

  it("aggregates activity feeds sorted by timestamp desc", async () => {
    const registry = new ToolRegistry();
    registry.register(
      createMockModule({
        name: "shortcut",
        getActivityFeed: async () => [
          {
            id: "1",
            source: "shortcut",
            type: "story",
            title: "Old",
            description: "",
            actor: "a",
            timestamp: "2024-01-01T00:00:00Z",
            url: "",
            metadata: {},
          },
        ],
      })
    );
    registry.register(
      createMockModule({
        name: "github",
        getActivityFeed: async () => [
          {
            id: "2",
            source: "github",
            type: "pr",
            title: "New",
            description: "",
            actor: "b",
            timestamp: "2024-06-01T00:00:00Z",
            url: "",
            metadata: {},
          },
        ],
      })
    );

    const feed = await registry.getActivityFeed({
      since: "2024-01-01",
      until: "2024-12-31",
    });
    expect(feed).toHaveLength(2);
    expect(feed[0].title).toBe("New");
    expect(feed[1].title).toBe("Old");
  });
});
