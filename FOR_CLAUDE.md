# Mission Control — FOR_CLAUDE.md

## Project Overview

Mission Control is a multi-source AI platform that started life as a simple Slack bot creating Shortcut tickets. It's evolving into a platform where a conversational agent can query Shortcut, GitHub, Notion, and Slack — all through the same `@shortbot` mention in Slack. A dashboard will surface the same data visually.

**One-sentence pitch:** An AI-powered Mission Control that unifies your project data across tools and makes it queryable from Slack.

## Technical Architecture

```
mission-control/
├── packages/
│   ├── integrations/     # Shared: API clients + tool defs + dashboard reads
│   │   └── src/
│   │       ├── types.ts       # IntegrationModule interface
│   │       ├── registry.ts    # ToolRegistry (collects + dispatches tools)
│   │       ├── fetch-utils.ts # Retry/backoff/cache wrapper
│   │       └── shortcut/      # First integration module
│   ├── bot/              # Slack bot (Express + Claude agent loop)
│   │   └── src/
│   │       ├── index.ts       # Express server + Slack event handling
│   │       ├── agent.ts       # Claude tool_use loop via ToolRegistry
│   │       ├── handler.ts     # Mention → agent → Slack reply
│   │       ├── system-prompt.ts  # Dynamic prompt from registry
│   │       └── slack.ts       # Slack API wrapper
│   └── dashboard/        # (Future) Next.js Mission Control UI
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
└── shortcut/
    ├── config.ts     # loadShortcutConfig() — env var validation
    ├── types.ts      # CreateStoryParams, UpdateStoryParams
    ├── client.ts     # ShortcutClient class (all API calls)
    ├── tools.ts      # Tool definitions + createExecutor()
    ├── reads.ts      # Dashboard data: getActivityFeed, getSummaryMetrics
    └── index.ts      # createShortcutModule() → IntegrationModule

packages/bot/src/
├── index.ts          # Express server, signature verification, dedup
├── handler.ts        # createHandler(registry) — orchestrates mention flow
├── agent.ts          # runAgent(registry, messages, instruction) — Claude loop
├── system-prompt.ts  # buildSystemPrompt(registry) — dynamic prompt
├── slack.ts          # Slack API: fetchThread, postReply, getPermalink
└── types.ts          # SlackMessage, AppMentionEvent
```

## Lessons Learned

### ESM Migration
- With `"module": "nodenext"`, all relative imports MUST have `.js` extensions
- `"type": "module"` in each package.json tells Node to treat .js as ESM
- Turbo's `dependsOn: ["^build"]` ensures integrations builds before bot typechecks

### Turbo Gotcha
- Turbo requires `"packageManager"` field in root package.json. Without it, you get a cryptic "Could not resolve workspaces" error.

### TypeScript Strict Mode + Record<string, unknown>
- Casting `Record<string, unknown>` directly to a typed interface with required fields fails with strict mode. Use `as unknown as TargetType` for tool input dispatch.

### Tool Name Prefixing
- Tools are defined WITHOUT prefix in each module (e.g., `create_story`)
- ToolRegistry adds the prefix at runtime (`shortcut_create_story`)
- System prompt references prefixed names since that's what Claude sees
