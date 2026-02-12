import type Anthropic from "@anthropic-ai/sdk";
import type { ShortcutClient } from "./client.js";
import type { CreateStoryParams } from "./types.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_story",
    description:
      "Create a new story in Shortcut. Returns the created story with its ID and URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Story title (start with a verb)",
        },
        description: {
          type: "string",
          description:
            "Story description in Markdown. Include {{SLACK_THREAD_URL}} placeholder for Slack link.",
        },
        story_type: {
          type: "string",
          enum: ["feature", "bug", "chore"],
          description: "Story type (default: feature)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to apply",
        },
        owner_ids: {
          type: "array",
          items: { type: "string" },
          description: "UUIDs of story owners",
        },
        workflow_state_id: {
          type: "number",
          description:
            "Workflow state ID (use shortcut_list_workflow_states to find)",
        },
        project_id: {
          type: "number",
          description: "Project ID (use shortcut_list_projects to find)",
        },
        estimate: {
          type: "number",
          description: "Point estimate (1, 2, 3, 5, 8)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_story",
    description:
      "Update an existing story in Shortcut. Can change any field.",
    input_schema: {
      type: "object" as const,
      properties: {
        story_id: {
          type: "number",
          description: "The story ID to update",
        },
        name: { type: "string", description: "New story title" },
        description: { type: "string", description: "New description" },
        story_type: {
          type: "string",
          enum: ["feature", "bug", "chore"],
        },
        owner_ids: {
          type: "array",
          items: { type: "string" },
          description: "New owner UUIDs",
        },
        workflow_state_id: {
          type: "number",
          description: "New workflow state ID",
        },
        estimate: { type: "number", description: "New estimate" },
        labels: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
          },
          description: "Labels to set",
        },
      },
      required: ["story_id"],
    },
  },
  {
    name: "get_story",
    description: "Get full details of a Shortcut story by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        story_id: { type: "number", description: "The story ID" },
      },
      required: ["story_id"],
    },
  },
  {
    name: "search_stories",
    description:
      'Search for stories in Shortcut. Uses Shortcut query syntax (e.g. type:feature, state:"In Progress", owner:name).',
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query using Shortcut syntax",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to a Shortcut story.",
    input_schema: {
      type: "object" as const,
      properties: {
        story_id: { type: "number", description: "The story ID" },
        text: {
          type: "string",
          description: "Comment text in Markdown",
        },
      },
      required: ["story_id", "text"],
    },
  },
  {
    name: "list_members",
    description:
      "List all workspace members. Use this to resolve names to UUIDs for owner assignment.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_workflow_states",
    description:
      "List all workflows and their states. Use this to find workflow_state_id values for status changes.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_labels",
    description: "List all available labels in the workspace.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_projects",
    description: "List all projects in the workspace.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

/** Creates a tool executor bound to a ShortcutClient instance */
export function createExecutor(client: ShortcutClient) {
  return async (
    name: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    try {
      let result: unknown;

      switch (name) {
        case "create_story":
          result = await client.createStory(input as unknown as CreateStoryParams);
          break;
        case "update_story": {
          const { story_id, ...params } = input;
          result = await client.updateStory(story_id as number, params);
          break;
        }
        case "get_story":
          result = await client.getStory(input.story_id as number);
          break;
        case "search_stories":
          result = await client.searchStories(input.query as string);
          break;
        case "add_comment":
          result = await client.addComment(
            input.story_id as number,
            input.text as string
          );
          break;
        case "list_members":
          result = await client.listMembers();
          break;
        case "list_workflow_states":
          result = await client.listWorkflowStates();
          break;
        case "list_labels":
          result = await client.listLabels();
          break;
        case "list_projects":
          result = await client.listProjects();
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
