import type Anthropic from "@anthropic-ai/sdk";
import type { NotionClient } from "./client.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search",
    description:
      "Search Notion for pages and databases by text. Returns titles, URLs, and last edited times.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search text",
        },
        page_size: {
          type: "number",
          description: "Number of results (default: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description:
      "Get a Notion page's properties. Returns simplified key-value properties, not raw Notion objects.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The Notion page ID (UUID format)",
        },
      },
      required: ["page_id"],
    },
  },
  {
    name: "query_database",
    description:
      "Query a Notion database. Returns rows with simplified properties. Use filters to narrow results.",
    input_schema: {
      type: "object" as const,
      properties: {
        database_id: {
          type: "string",
          description: "The Notion database ID (UUID format)",
        },
        page_size: {
          type: "number",
          description: "Number of rows to return (default: 50)",
        },
      },
      required: ["database_id"],
    },
  },
];

/** Creates a tool executor bound to a NotionClient instance */
export function createExecutor(client: NotionClient) {
  return async (
    name: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    try {
      let result: unknown;

      switch (name) {
        case "search":
          result = await client.search(input.query as string, {
            page_size: input.page_size as number | undefined,
          });
          break;
        case "get_page":
          result = await client.getPage(input.page_id as string);
          break;
        case "query_database":
          result = await client.queryDatabase(
            input.database_id as string,
            {
              page_size: input.page_size as number | undefined,
              filter: input.filter as Record<string, unknown> | undefined,
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
