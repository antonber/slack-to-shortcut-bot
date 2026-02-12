# Mission Control — FOR_CLAUDE.md

## Project Overview

Mission Control is a multi-source AI platform that started life as a simple Slack bot creating Shortcut tickets. It's a platform where a conversational agent can query Shortcut, GitHub, Notion, and Slack — all through the same `@shortbot` mention in Slack. A Next.js dashboard surfaces the same data visually with metrics, activity timelines, and Claude-powered summaries.

**One-sentence pitch:** An AI-powered Mission Control that unifies your project data across tools and makes it queryable from Slack and a dashboard.

## Technical Architecture

```
mission-control/
├── packages/
│   ├── integrations/     # Shared: API clients + tool defs + dashboard reads
│   │   └── src/
│   │       ├── types.ts       # IntegrationModule interface
│   │       ├── registry.ts    # ToolRegistry (collects + dispatches tools)
│   │       ├── fetch-utils.ts # Retry/backoff/cache wrapper
│   │       ├── shortcut/      # Shortcut integration (9 tools)
│   │       ├── github/        # GitHub integration (5 tools)
│   │       ├── notion/        # Notion integration (3 tools)
│   │       └── slack-data/    # Slack Data integration (2 tools)
│   ├── bot/              # Slack bot (Express + Claude agent loop)
│   │   └── src/
│   │       ├── index.ts       # Express server + Slack event handling
│   │       ├── agent.ts       # Claude tool_use loop via ToolRegistry
│   │       ├── handler.ts     # Mention → agent → Slack reply
│   │       ├── system-prompt.ts  # Dynamic prompt from registry
│   │       └── slack.ts       # Slack API wrapper
│   └── dashboard/        # Next.js Mission Control UI
│       └── src/
│           ├── middleware.ts   # Auth (DASHBOARD_API_KEY)
│           ├── lib/           # Registry singleton, auth helper
│           └── app/           # Pages: overview, activity, shortcut, github
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Key Pattern: IntegrationModule

Every integration (Shortcut, GitHub, Notion, etc.) exports the same interface:
- `tools` + `executeTool()` — for the Claude agent in the bot
- `getActivityFeed()` + `getSummaryMetrics()` — for the dashboard

Both share the same API client. The **ToolRegistry** collects modules, prefixes tool names (`shortcut_create_story`), and dispatches execution.

### Data Flow

1. User mentions `@shortbot` in Slack thread
2. Express server receives webhook, verifies signature, deduplicates
3. Handler fetches thread, runs agent with ToolRegistry
4. Agent loop: Claude calls prefixed tools → registry dispatches → results returned
5. Response post-processed (Markdown→mrkdwn) and posted to Slack

## Technology Choices & Rationale

| Choice | Why | Alternatives Considered |
|--------|-----|------------------------|
| pnpm + Turborepo | Fast, TypeScript-native monorepo. Right weight class for 2-3 packages | npm workspaces (slow), Nx (overkill) |
| ESM (`"module": "nodenext"`) | Future-proof, works with Next.js dashboard | CommonJS (would need interop shims) |
| No database (MVP) | Live API calls + in-memory TTL cache. Simplicity first | PostgreSQL (premature for MVP) |
| vitest | Fast, ESM-native, great TypeScript support | Jest (ESM pain), node:test (limited) |
| No MCP | Direct function calls simpler when we own all integrations | MCP server per integration (overhead) |

## Codebase Structure

```
packages/integrations/src/
├── types.ts          # IntegrationModule, ActivityEvent, TimeRange interfaces
├── registry.ts       # ToolRegistry class — the integration hub
├── fetch-utils.ts    # fetchWithRetry() with backoff + TTL cache
├── index.ts          # Re-exports everything
├── shortcut/         # 9 tools: create/update/get/search stories, comments, lists
│   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
├── github/           # 5 tools: PRs, issues, search, commits
│   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
├── notion/           # 3 tools: search, get_page, query_database
│   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
└── slack-data/       # 2 tools: search_messages, get_channel_history
    ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts

packages/bot/src/
├── index.ts          # Express server, signature verification, dedup
├── handler.ts        # createHandler(registry) — orchestrates mention flow
├── agent.ts          # runAgent(registry, messages, instruction) — Claude loop
├── system-prompt.ts  # buildSystemPrompt(registry) — dynamic prompt
├── slack.ts          # Slack API: fetchThread, postReply, getPermalink
└── types.ts          # SlackMessage, AppMentionEvent

packages/dashboard/src/
├── middleware.ts      # Auth middleware — checks DASHBOARD_API_KEY on all routes
├── lib/
│   ├── integrations.ts  # Singleton registry factory + getTimeRange helper
│   └── auth.ts          # Bearer token / query param auth
└── app/
    ├── layout.tsx     # Root layout with nav bar
    ├── page.tsx       # Overview page with integration metric cards
    ├── activity/      # Unified activity timeline across all sources
    ├── shortcut/      # Shortcut deep-dive with metrics + activity
    ├── github/        # GitHub deep-dive with metrics + activity
    └── api/summarize/ # POST endpoint — Claude-powered AI summary
```

## Lessons Learned

### ESM Migration
- With `"module": "nodenext"`, all relative imports MUST have `.js` extensions
- `"type": "module"` in each package.json tells Node to treat .js as ESM
- Turbo's `dependsOn: ["^build"]` ensures integrations builds before bot typechecks
- **Dashboard exception:** Next.js uses `"moduleResolution": "bundler"` (not nodenext) since Next.js has its own resolution

### Turbo Gotcha
- Turbo requires `"packageManager"` field in root package.json. Without it, you get a cryptic "Could not resolve workspaces" error.

### TypeScript Strict Mode + Record<string, unknown>
- Casting `Record<string, unknown>` directly to a typed interface with required fields fails with strict mode. Use `as unknown as TargetType` for tool input dispatch.

### Tool Name Prefixing
- Tools are defined WITHOUT prefix in each module (e.g., `create_story`)
- ToolRegistry adds the prefix at runtime (`shortcut_create_story`)
- System prompt references prefixed names since that's what Claude sees

### Notion SDK Types
- `@notionhq/client` TypeScript types don't always include all methods on namespaces (e.g., `databases.query`). Fixed with type assertion: `(this.notion.databases as any).query.bind(...)`.

### Slack Data Opt-in
- Slack Data integration reuses `SLACK_BOT_TOKEN` but needs extra OAuth scopes (`search:read`). Requires explicit `SLACK_DATA_ENABLED=true` to prevent accidental activation.

### Next.js + Workspace Dependencies
- Next.js needs `transpilePackages: ["@mission-control/integrations"]` to resolve workspace dependencies correctly.
- Use `output: "standalone"` for Docker deployments — copies only needed files.
