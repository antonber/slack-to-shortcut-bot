# Slack-to-Shortcut Ticket Agent — Project Spec

## Overview

A lightweight Node.js service that listens for a specific emoji reaction (🎫 `:ticket:`) on Slack messages, reads the full thread, uses Claude to generate a structured Shortcut ticket, creates it via the Shortcut API, and replies in the Slack thread with a link to the new story.

## Architecture

Single Express server with three integrations:

```
Slack (Events API) → Agent Server → Claude API → Shortcut API → Slack (Post Reply)
```

**Runtime:** Node.js (>=18)
**Framework:** Express
**Deployment target:** Railway, Render, or any container host
**Language:** TypeScript

## Environment Variables

```
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token (Slack app)
SLACK_SIGNING_SECRET=...           # For verifying Slack request signatures
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key
SHORTCUT_API_TOKEN=...             # Shortcut API token
SHORTCUT_PROJECT_ID=...            # Default Shortcut project ID to assign stories to
SHORTCUT_WORKFLOW_STATE_ID=...     # Default workflow state (e.g., "Unscheduled" or "Backlog")
PORT=3000                          # Server port
```

## Slack App Configuration

The Slack app needs the following setup:

### OAuth Scopes (Bot Token)
- `reactions:read` — detect reaction events
- `channels:history` — read messages in public channels
- `groups:history` — read messages in private channels the bot is in
- `chat:write` — post replies in threads

### Event Subscriptions
Subscribe to the following bot events:
- `reaction_added`

### Request URL
`https://<your-domain>/slack/events`

## File Structure

```
├── src/
│   ├── index.ts              # Express server, Slack event listener, request verification
│   ├── slack.ts              # Slack API helpers (fetch thread, post reply)
│   ├── shortcut.ts           # Shortcut API helpers (create story)
│   ├── agent.ts              # Claude API call with prompt, parse structured output
│   ├── handler.ts            # Main orchestration: thread → LLM → ticket → reply
│   └── types.ts              # Shared TypeScript interfaces
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Detailed Flow

### 1. Receive Slack Event (`src/index.ts`)

- Express POST endpoint at `/slack/events`
- Verify request signature using `SLACK_SIGNING_SECRET` (use `@slack/events-api` or manual HMAC verification)
- Handle Slack's URL verification challenge (`{ "type": "url_verification" }`) by returning the `challenge` field
- For `reaction_added` events, check:
  - `event.reaction === "ticket"` (the 🎫 emoji name)
  - Ignore if the reaction was added by the bot itself (prevent loops)
- If it matches, call the handler asynchronously (return 200 to Slack immediately to avoid timeout)

### 2. Fetch Thread (`src/slack.ts`)

```typescript
async function fetchThread(channel: string, threadTs: string): Promise<SlackMessage[]>
```

- Use Slack Web API `conversations.replies` with `channel` and `ts` (the thread parent `ts`)
- The `event.item.ts` from the reaction event gives you the message timestamp
- If the reacted message is not a thread parent, first fetch the message to get its `thread_ts`, then fetch the full thread
- Return array of messages with: `user`, `text`, `ts`, `files` (note file names if any)
- Handle pagination if thread is very long (>100 messages)

### 3. Generate Ticket via Claude (`src/agent.ts`)

```typescript
async function generateTicket(messages: SlackMessage[]): Promise<ShortcutTicket>
```

- Format thread messages into a readable transcript:
  ```
  @username (12:34 PM): message text
  @username2 (12:35 PM): reply text
  ```
- Call the Anthropic API (`claude-sonnet-4-20250514`) with the following system prompt:

```
You are a project management assistant. Given a Slack thread, create a Shortcut (project management tool) story.

Analyze the thread to determine:
1. What is being requested or discussed
2. Any technical details or requirements mentioned
3. Who is involved and any assignments implied
4. Priority/urgency signals

Respond with ONLY valid JSON in this exact format:
{
  "name": "Short, actionable ticket title",
  "description": "Detailed description in Markdown format. Include:\n- Context/background from the thread\n- Requirements or acceptance criteria\n- Any relevant technical details\n- Link back to Slack thread (placeholder: {{SLACK_THREAD_URL}})",
  "story_type": "feature" | "bug" | "chore",
  "labels": ["array", "of", "relevant", "labels"],
  "estimate": null | 1 | 2 | 3 | 5 | 8
}

Rules:
- Title should be concise and start with a verb (e.g., "Add...", "Fix...", "Investigate...")
- Default story_type to "feature" unless the thread clearly describes a bug or maintenance task
- Only include labels that would genuinely help categorize the work
- Only set estimate if the thread has enough detail to size it; otherwise null
- Include all meaningful context from the thread in the description — the ticket should be understandable without reading the original Slack thread
```

- Parse the JSON response. If parsing fails, retry once with a nudge to return valid JSON.
- Return typed `ShortcutTicket` object.

### 4. Create Shortcut Story (`src/shortcut.ts`)

```typescript
async function createStory(ticket: ShortcutTicket): Promise<{ id: number; url: string }>
```

- POST to `https://api.app.shortcut.com/api/v3/stories`
- Headers: `{ "Content-Type": "application/json", "Shortcut-Token": SHORTCUT_API_TOKEN }`
- Body:
  ```json
  {
    "name": "<ticket.name>",
    "description": "<ticket.description>",
    "story_type": "<ticket.story_type>",
    "project_id": "<SHORTCUT_PROJECT_ID as number>",
    "workflow_state_id": "<SHORTCUT_WORKFLOW_STATE_ID as number>",
    "labels": [{ "name": "<label>" }],
    "estimate": "<ticket.estimate or omit if null>"
  }
  ```
- Labels: Shortcut auto-creates labels if they don't exist, so just pass `{ name: "label-name" }` objects
- Return the story `id` and construct the URL: `https://app.shortcut.com/story/${id}`

### 5. Reply in Slack Thread (`src/slack.ts`)

```typescript
async function postThreadReply(channel: string, threadTs: string, text: string): Promise<void>
```

- Use `chat.postMessage` with `channel`, `thread_ts`, and `text`
- Message format:
  ```
  ✅ Shortcut ticket created: *<ticket.name>*
  <story_url>
  Type: <story_type> · Estimate: <estimate or "Unestimated">
  ```
- Also replace the `{{SLACK_THREAD_URL}}` placeholder in the Shortcut description with the actual Slack thread permalink (construct from channel + thread_ts, or use `chat.getPermalink`)

### 6. Orchestration (`src/handler.ts`)

```typescript
async function handleTicketReaction(event: ReactionAddedEvent): Promise<void>
```

This is the main pipeline:

1. Fetch the thread
2. Generate the ticket via Claude
3. Get the Slack thread permalink
4. Replace `{{SLACK_THREAD_URL}}` in the ticket description with the actual permalink
5. Create the Shortcut story
6. Reply in the Slack thread with the story link
7. If any step fails, reply in the thread with an error message: "❌ Failed to create ticket: <reason>"

## Types (`src/types.ts`)

```typescript
interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  files?: { name: string; mimetype: string }[];
}

interface ShortcutTicket {
  name: string;
  description: string;
  story_type: "feature" | "bug" | "chore";
  labels: string[];
  estimate: number | null;
}

interface ReactionAddedEvent {
  type: "reaction_added";
  user: string;
  reaction: string;
  item: {
    type: "message";
    channel: string;
    ts: string;
  };
  event_ts: string;
}
```

## Error Handling

- **Slack signature verification fails:** Return 401, log warning
- **Thread fetch fails:** Reply in channel (not thread) that the bot couldn't read the thread. Likely a permissions issue — message should say to invite the bot to the channel.
- **Claude API fails / returns invalid JSON:** Retry once. If still fails, reply in thread with error.
- **Shortcut API fails:** Reply in thread with error and the raw ticket content so it's not lost.
- **Duplicate detection:** Track processed `event.item.ts + event.item.channel` combos in memory (a simple Set) to avoid creating duplicate tickets if Slack retries the event. Clear entries after 5 minutes.

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@slack/web-api": "latest",
    "express": "^4",
    "dotenv": "latest"
  },
  "devDependencies": {
    "@types/express": "latest",
    "@types/node": "latest",
    "typescript": "latest",
    "tsx": "latest"
  }
}
```

## Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## Local Development

1. `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Use ngrok (`ngrok http 3000`) to expose local server for Slack events
4. Set Slack app Event Subscription URL to `https://<ngrok-url>/slack/events`
5. `npm run dev`
6. React with 🎫 on any message in a channel the bot is in

## Future Enhancements (Out of Scope for V1)

- **Custom emoji triggers:** Support multiple emojis mapping to different story types or workflows
- **Shortcut team/member assignment:** Map Slack users to Shortcut members and auto-assign
- **Interactive refinement:** After posting the ticket link, add a Slack Block Kit button "Edit before saving" that opens a modal to tweak the ticket before it's actually created
- **Label taxonomy:** Maintain a config file of valid labels so Claude picks from a known set
- **Multiple workspace support:** Support multiple Slack workspaces / Shortcut orgs