# Mission Control — Project Spec

## Overview

Mission Control is a multi-source AI platform that unifies project data across Shortcut, GitHub, Notion, and Slack. It has two interfaces:

1. **Slack bot** — mention `@shortbot` in any thread to ask questions, create stories, search across integrations, or get status updates. Powered by Claude's agentic tool_use loop.
2. **Dashboard** — a Next.js web UI that surfaces activity feeds, metrics, and AI-generated summaries across all integrations. Auth-protected via API key.

Both interfaces share the same integration layer: every data source implements the `IntegrationModule` interface, which exposes tools for the agent AND typed read methods for the dashboard.

## Architecture

```
┌──────────────────┐     ┌──────────────────────────────────────────┐
│    Slack User     │     │              Dashboard User               │
│  @shortbot ...    │     │         (Cloudflare Access / API key)     │
└────────┬─────────┘     └────────────────┬───────────────────────────┘
         │                                │
         ▼                                ▼
┌──────────────────┐     ┌────────────────────────────────────────────┐
│   packages/bot   │     │          packages/dashboard (planned)       │
│   Express server │     │          Next.js App Router                 │
│   Claude agent   │     │          Server Components                  │
│      loop        │     │          /api/summarize                     │
└────────┬─────────┘     └────────────────┬───────────────────────────┘
         │                                │
         │  tools + executeTool()         │  getActivityFeed()
         │                                │  getSummaryMetrics()
         ▼                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                   packages/integrations                            │
│                                                                    │
│   ToolRegistry ──┬── Shortcut module (tools + reads + client)     │
│                  ├── GitHub module    (tools + reads + client)     │
│                  ├── Notion module    (tools + reads + client)     │
│                  └── Slack data module (tools + reads + client)    │
│                                                                    │
│   fetch-utils: retry, backoff, timeout, in-memory TTL cache       │
└────────────────────────────────────────────────────────────────────┘
```

**Runtime:** Node.js 20+
**Language:** TypeScript (strict mode, ESM with `"module": "nodenext"`)
**Monorepo:** pnpm workspaces + Turborepo
**Deployment:** Railway (Docker)

## Core Pattern: IntegrationModule

Every data source implements this interface:

```typescript
interface IntegrationModule {
  name: string;                    // "shortcut", "github", etc.
  description: string;             // Human-readable, used in system prompt
  isConfigured: () => boolean;     // Checks env vars

  // Agent tools (for bot)
  tools: Anthropic.Tool[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>;

  // Dashboard reads (typed, structured)
  getActivityFeed: (range: TimeRange) => Promise<ActivityEvent[]>;
  getSummaryMetrics: (range: TimeRange) => Promise<Record<string, number>>;
}
```

The **ToolRegistry** collects all configured modules, prefixes tool names (`shortcut_create_story`, `github_list_prs`), and handles dispatch. The bot's system prompt is generated dynamically from registered modules.

## Monorepo Structure

```
├── packages/
│   ├── integrations/              # Shared integration layer
│   │   └── src/
│   │       ├── types.ts           # IntegrationModule, ActivityEvent, TimeRange
│   │       ├── registry.ts        # ToolRegistry class
│   │       ├── fetch-utils.ts     # Retry/backoff/timeout/cache wrapper
│   │       ├── shortcut/          # Shortcut integration module
│   │       │   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
│   │       ├── github/            # GitHub integration module
│   │       │   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
│   │       ├── notion/            # Notion integration module
│   │       │   ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
│   │       └── slack-data/        # Slack Data integration module
│   │           ├── config.ts, types.ts, client.ts, tools.ts, reads.ts, index.ts
│   ├── bot/                       # Slack bot (Express + Claude agent)
│   │   └── src/
│   │       ├── index.ts           # Express server, signature verification, dedup
│   │       ├── handler.ts         # Mention → agent → Slack reply
│   │       ├── agent.ts           # Claude tool_use loop via ToolRegistry
│   │       ├── system-prompt.ts   # Dynamic prompt from registry metadata
│   │       ├── slack.ts           # Slack API (thread fetch, reply, permalink)
│   │       └── types.ts           # SlackMessage, AppMentionEvent
│   └── dashboard/                 # Next.js Mission Control UI
│       └── src/
│           ├── middleware.ts       # Auth middleware (DASHBOARD_API_KEY)
│           ├── lib/integrations.ts # Singleton registry + time range helper
│           ├── lib/auth.ts        # Bearer token / query param auth
│           └── app/
│               ├── layout.tsx     # Root layout with nav
│               ├── page.tsx       # Overview (integration metric cards)
│               ├── activity/      # Unified activity timeline
│               ├── shortcut/      # Shortcut deep-dive
│               ├── github/        # GitHub deep-dive
│               └── api/summarize/ # Claude-powered summary endpoint
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── Dockerfile                     # Multi-stage monorepo build for bot
└── .env.example
```

## Environment Variables

```
# Required
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token
SLACK_SIGNING_SECRET=...           # For verifying Slack request signatures
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key
SHORTCUT_API_TOKEN=...             # Shortcut API token

# Optional (Bot)
SHORTCUT_PROJECT_ID=...            # Default project for new stories
SHORTCUT_WORKFLOW_STATE_ID=...     # Default workflow state (e.g., "Backlog")
PORT=3000                          # Server port

# GitHub integration
GITHUB_TOKEN=...                   # GitHub personal access token
GITHUB_REPOS=org/repo1,org/repo2  # Allowed repos (comma-separated)
GITHUB_ORG=...                     # Default GitHub org

# Notion integration
NOTION_TOKEN=...                   # Notion integration token
NOTION_ALLOWED_DATABASES=...       # Allowed database IDs (comma-separated)

# Slack Data integration (opt-in, requires extra scopes)
SLACK_DATA_ENABLED=true            # Must be explicitly set to enable
# (Reuses SLACK_BOT_TOKEN — requires additional search:read scope)

# Dashboard
DASHBOARD_API_KEY=...              # Bearer token for dashboard auth
```

## Slack App Configuration

### OAuth Scopes (Bot Token)
- `app_mentions:read` — detect @shortbot mentions
- `channels:history` — read messages in public channels
- `groups:history` — read messages in private channels
- `chat:write` — post replies in threads

### Event Subscriptions
- `app_mention` — bot event

### Request URL
`https://<your-domain>/slack/events`

## Bot Flow

### 1. Receive Slack Event (`packages/bot/src/index.ts`)

- Express POST at `/slack/events`
- Verify request signature (HMAC SHA256 with 5-minute timestamp window)
- Handle URL verification challenge
- Filter for `app_mention` events
- Deduplicate (in-memory Set, 5-minute TTL on `channel:event_ts`)
- Return 200 immediately, process asynchronously

### 2. Handle Mention (`packages/bot/src/handler.ts`)

1. Post acknowledgment: "🤖 On it..."
2. Strip `<@botid>` from message text to get user instruction
3. Fetch full thread via `conversations.replies` (paginated, handles reply-to-reply)
4. Get thread permalink
5. Run Claude agent with ToolRegistry
6. Post-process response: replace `{{SLACK_THREAD_URL}}` placeholder, convert Markdown → Slack mrkdwn
7. Post response to thread

### 3. Agent Loop (`packages/bot/src/agent.ts`)

- Formats thread into readable transcript with timestamps
- Sends to Claude (`claude-sonnet-4-20250514`) with dynamic system prompt + registry tools
- Loop (max 15 iterations):
  - If Claude returns text → done, return response
  - If Claude returns tool_use → execute all tools via `registry.executeTool()`, append results, continue
- Tools are dispatched through the ToolRegistry which strips the prefix and routes to the correct module

### 4. System Prompt (`packages/bot/src/system-prompt.ts`)

Generated dynamically from `registry.getModuleDescriptions()`. Includes:
- Bot identity and available integrations
- Slack mrkdwn formatting rules (not Markdown)
- Story link format guidance
- Tool usage tips (prefixed names like `shortcut_list_members`)
- Behavioral guidelines (be conversational, use tools proactively, default smartly)

## Shortcut Integration

### Tools (9 total, prefixed `shortcut_*`)

| Tool | Description |
|------|-------------|
| `shortcut_create_story` | Create a story with name, description, type, labels, owners, estimate |
| `shortcut_update_story` | Update any field on an existing story |
| `shortcut_get_story` | Get full story details by ID |
| `shortcut_search_stories` | Search using Shortcut query syntax |
| `shortcut_add_comment` | Add a comment to a story |
| `shortcut_list_members` | List workspace members (cached 5min) |
| `shortcut_list_workflow_states` | List all workflow states (cached 5min) |
| `shortcut_list_labels` | List all labels (cached 5min) |
| `shortcut_list_projects` | List all projects (cached 5min) |

### Dashboard Reads
- `getActivityFeed(range)` — recently updated stories in time range
- `getSummaryMetrics(range)` — stories created/completed counts

### Client
HTTP client wrapping Shortcut API v3 (`https://api.app.shortcut.com/api/v3`), using `fetchWithRetry` for reliability. Reference data endpoints (members, labels, workflows, projects) use in-memory TTL cache (5 minutes).

## Reliability Layer (`fetch-utils.ts`)

All integration HTTP calls go through `fetchWithRetry`:
- **Retry:** 3 attempts with exponential backoff (200ms, 400ms, 800ms)
- **Timeout:** 10 seconds per request (AbortController)
- **Cache:** Optional in-memory TTL cache for read-heavy endpoints
- **Smart retry:** No retry on 4xx errors (except 429 rate limiting)

## Error Handling

- **Slack signature verification fails:** 401 response, logged warning
- **Thread fetch fails:** Error posted to Slack thread
- **Claude API fails:** Error posted to thread with reason
- **Tool execution fails:** JSON error returned to Claude, agent can retry or report
- **Duplicate events:** Silently dropped (in-memory dedup with 5-minute TTL)
- **Unconfigured integrations:** Silently skipped at registration (ToolRegistry only registers modules where `isConfigured()` returns true)

## GitHub Integration

### Tools (5 total, prefixed `github_*`)

| Tool | Description |
|------|-------------|
| `github_list_prs` | List pull requests for a repo (filterable by state) |
| `github_get_pr` | Get full PR details including body, review status, merge info |
| `github_list_issues` | List issues for a repo (filterable by state, labels) |
| `github_search_issues` | Search issues/PRs using GitHub search syntax |
| `github_recent_commits` | Get recent commits for a repo/branch |

### Dashboard Reads
- `getActivityFeed(range)` — merged PRs + closed issues
- `getSummaryMetrics(range)` — PRs merged/opened, issues opened/closed, avg merge hours

### Client
Uses `@octokit/rest`. Scoped to `GITHUB_REPOS` allowlist — unknown repos are rejected. `resolveRepo()` auto-selects if only one repo is configured.

## Notion Integration

### Tools (3 total, prefixed `notion_*`)

| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases by query text |
| `notion_get_page` | Get page content with all properties |
| `notion_query_database` | Query a database with optional filters and sorts |

### Dashboard Reads
- `getActivityFeed(range)` — recently edited pages
- `getSummaryMetrics(range)` — pages_updated count

### Client
Uses `@notionhq/client`. Scoped to `NOTION_ALLOWED_DATABASES` allowlist. Property values are simplified from Notion's deeply nested format.

## Slack Data Integration

### Tools (2 total, prefixed `slack_data_*`)

| Tool | Description |
|------|-------------|
| `slack_data_search_messages` | Search Slack messages by query |
| `slack_data_get_channel_history` | Get recent messages from a channel |

### Configuration
Requires explicit opt-in via `SLACK_DATA_ENABLED=true` because it needs additional OAuth scopes (`search:read`). Reuses `SLACK_BOT_TOKEN`.

### Dashboard Reads
- `getActivityFeed(range)` — messages matching time range
- `getSummaryMetrics(range)` — messages_found count

## Dashboard

### Auth
All routes protected by `DASHBOARD_API_KEY` via Bearer token header or `?key=` query parameter. Implemented as Next.js middleware.

### Pages
- **Overview** (`/`) — integration cards with key metrics, time range selector
- **Activity** (`/activity`) — unified timeline from all sources, color-coded by integration
- **Shortcut** (`/shortcut`) — metrics + recent activity deep-dive
- **GitHub** (`/github`) — metrics (including avg merge hours) + recent activity

### API
- **POST `/api/summarize`** — fetches activity + metrics, sends to Claude (`claude-sonnet-4-20250514`) for natural language summary. Accepts `{ range: "day" | "week" | "month" }`.

### Tech Stack
Next.js 14 App Router, Tailwind CSS, Server Components for data fetching. `output: "standalone"` for Docker deployment.

## Development

```bash
pnpm install                              # Install all workspace dependencies
pnpm turbo build                          # Build all packages
pnpm turbo typecheck                      # TypeScript check (tsc --noEmit)
pnpm turbo test                           # Run all tests (vitest)
pnpm turbo dev --filter=@mission-control/bot  # Dev server with hot reload
```

For local Slack testing, expose the server with a tunnel:
```bash
ngrok http 3000        # or: cloudflared tunnel --url http://localhost:3000
```
Then set your Slack app's event subscription URL to the tunnel URL + `/slack/events`.

## Deployment

Railway auto-deploys from `main` via Docker. Two services:

### Bot (`Dockerfile`)
- Multi-stage build: `node:20-slim` + `corepack enable` for pnpm
- Builder stage: `pnpm install` → `pnpm turbo build --filter=@mission-control/bot`
- Runtime stage: copies only `dist/` + prod deps
- Entry: `node packages/bot/dist/index.js`

### Dashboard (`Dockerfile.dashboard`)
- Multi-stage build: `node:20-slim` + `corepack enable`
- Builder stage: `pnpm install` → `pnpm turbo build --filter=@mission-control/dashboard`
- Runtime stage: copies Next.js standalone output + static assets
- Entry: `node packages/dashboard/server.js`
- Port: 3000

## Roadmap

### Completed
- Phase 1: Monorepo foundation + Shortcut extraction
- Phase 2: GitHub integration (5 tools + dashboard reads)
- Phase 3: Notion integration (3 tools + dashboard reads)
- Phase 4: Slack Data integration (2 tools + dashboard reads)
- Phase 5: Dashboard MVP (overview, activity, deep-dive pages, AI summary)

### Phase 6: Polish + BigQuery (Future)
- BigQuery integration for product metrics
- PostgreSQL for historical data caching
- Webhook ingestion for real-time updates
- Advanced analytics (velocity, stale story scoring)
- Dashboard charts (Tremor/Recharts)
- Notion + Slack Data deep-dive pages
