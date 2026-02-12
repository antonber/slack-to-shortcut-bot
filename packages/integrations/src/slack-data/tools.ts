import type Anthropic from "@anthropic-ai/sdk";
import type { SlackDataClient } from "./client.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_messages",
    description:
      "Search Slack messages across all channels. Returns matching messages with channel, author, text, and permalink.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            'Search query. Supports Slack search syntax: "in:#channel", "from:@user", "has:link", date ranges, etc.',
        },
        count: {
          type: "number",
          description: "Number of results (default: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_channel_history",
    description:
      "Get recent messages from a Slack channel. Returns messages with author, text, timestamp, and thread info.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Channel ID (e.g., C01ABCDEF)",
        },
        limit: {
          type: "number",
          description: "Number of messages (default: 50)",
        },
      },
      required: ["channel"],
    },
  },
];

/** Creates a tool executor bound to a SlackDataClient instance */
export function createExecutor(client: SlackDataClient) {
  return async (
    name: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    try {
      let result: unknown;

      switch (name) {
        case "search_messages":
          result = await client.searchMessages(input.query as string, {
            count: input.count as number | undefined,
          });
          break;
        case "get_channel_history":
          result = await client.getChannelHistory(
            input.channel as string,
            {
              limit: input.limit as number | undefined,
            }
          );
          break;
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }

      return JSON.stringify(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: message });
    }
  };
}
