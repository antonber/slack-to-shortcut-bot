import type Anthropic from "@anthropic-ai/sdk";
import type { IntegrationModule, TimeRange, ActivityEvent } from "./types.js";

export class ToolRegistry {
  private modules = new Map<string, IntegrationModule>();

  register(module: IntegrationModule): void {
    if (module.isConfigured()) {
      this.modules.set(module.name, module);
    }
  }

  /** Returns all tools from registered modules, prefixed with module name */
  getTools(): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];
    for (const [prefix, mod] of this.modules) {
      for (const tool of mod.tools) {
        tools.push({ ...tool, name: `${prefix}_${tool.name}` });
      }
    }
    return tools;
  }

  /** Dispatches a prefixed tool name to the correct module */
  async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    for (const [prefix, mod] of this.modules) {
      if (name.startsWith(`${prefix}_`)) {
        const toolName = name.slice(prefix.length + 1);
        return mod.executeTool(toolName, input);
      }
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  /** Returns name + description for each registered module (for system prompt) */
  getModuleDescriptions(): { name: string; description: string }[] {
    return Array.from(this.modules.values()).map((m) => ({
      name: m.name,
      description: m.description,
    }));
  }

  /** Returns all registered modules (for dashboard data fetching) */
  getModules(): IntegrationModule[] {
    return Array.from(this.modules.values());
  }

  /** Aggregates activity feeds from all modules */
  async getActivityFeed(range: TimeRange): Promise<ActivityEvent[]> {
    const feeds = await Promise.all(
      Array.from(this.modules.values()).map((m) => m.getActivityFeed(range))
    );
    return feeds
      .flat()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /** Aggregates summary metrics from all modules */
  async getSummaryMetrics(
    range: TimeRange
  ): Promise<Record<string, Record<string, number>>> {
    const result: Record<string, Record<string, number>> = {};
    for (const [name, mod] of this.modules) {
      result[name] = await mod.getSummaryMetrics(range);
    }
    return result;
  }
}
