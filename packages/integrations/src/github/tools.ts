import type Anthropic from "@anthropic-ai/sdk";
import type { GitHubClient } from "./client.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_prs",
    description:
      "List pull requests for a GitHub repository. Returns title, author, status, branch, and URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description:
            'Repository in "owner/repo" format. Omit to use the default repo (if only one is configured).',
        },
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "PR state filter (default: open)",
        },
        per_page: {
          type: "number",
          description: "Number of results to return (default: 20, max: 100)",
        },
      },
    },
  },
  {
    name: "get_pr",
    description:
      "Get detailed information about a specific pull request, including diff stats, reviewers, and description.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: 'Repository in "owner/repo" format.',
        },
        pr_number: {
          type: "number",
          description: "The pull request number",
        },
      },
      required: ["pr_number"],
    },
  },
  {
    name: "list_issues",
    description:
      "List issues (not pull requests) for a GitHub repository.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description:
            'Repository in "owner/repo" format. Omit to use the default repo.',
        },
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Issue state filter (default: open)",
        },
        labels: {
          type: "string",
          description: "Comma-separated list of label names to filter by",
        },
        per_page: {
          type: "number",
          description: "Number of results (default: 20)",
        },
      },
    },
  },
  {
    name: "search_issues",
    description:
      'Search issues and pull requests across all configured repos using GitHub search syntax (e.g. "is:pr is:merged author:username", "label:bug is:open").',
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "GitHub search query. Repo scope is added automatically.",
        },
        per_page: {
          type: "number",
          description: "Number of results (default: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "recent_commits",
    description:
      "List recent commits on a branch. Shows commit message, author, and date.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: 'Repository in "owner/repo" format.',
        },
        branch: {
          type: "string",
          description: "Branch name (default: repo's default branch)",
        },
        per_page: {
          type: "number",
          description: "Number of commits (default: 20)",
        },
      },
    },
  },
];

/** Creates a tool executor bound to a GitHubClient instance */
export function createExecutor(client: GitHubClient) {
  return async (
    name: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    try {
      let result: unknown;

      switch (name) {
        case "list_prs":
          result = await client.listPRs(
            client.resolveRepo(input.repo as string | undefined),
            {
              state: input.state as "open" | "closed" | "all" | undefined,
              per_page: input.per_page as number | undefined,
            }
          );
          break;
        case "get_pr":
          result = await client.getPR(
            client.resolveRepo(input.repo as string | undefined),
            input.pr_number as number
          );
          break;
        case "list_issues":
          result = await client.listIssues(
            client.resolveRepo(input.repo as string | undefined),
            {
              state: input.state as "open" | "closed" | "all" | undefined,
              labels: input.labels as string | undefined,
              per_page: input.per_page as number | undefined,
            }
          );
          break;
        case "search_issues":
          result = await client.searchIssues(input.query as string, {
            per_page: input.per_page as number | undefined,
          });
          break;
        case "recent_commits":
          result = await client.recentCommits(
            client.resolveRepo(input.repo as string | undefined),
            {
              branch: input.branch as string | undefined,
              per_page: input.per_page as number | undefined,
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
