import Anthropic from "@anthropic-ai/sdk";
import { SlackMessage, ShortcutTicket } from "./types";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a project management assistant. Given a Slack thread, create a Shortcut (project management tool) story.

Analyze the thread to determine:
1. What is being requested or discussed
2. Any technical details or requirements mentioned
3. Who is involved and any assignments implied
4. Priority/urgency signals

Respond with ONLY valid JSON in this exact format:
{
  "name": "Short, actionable ticket title",
  "description": "Detailed description in Markdown format. Include:\\n- Context/background from the thread\\n- Requirements or acceptance criteria\\n- Any relevant technical details\\n- Link back to Slack thread (placeholder: {{SLACK_THREAD_URL}})",
  "story_type": "feature" | "bug" | "chore",
  "labels": ["array", "of", "relevant", "labels"],
  "estimate": null | 1 | 2 | 3 | 5 | 8
}

Rules:
- Title should be concise and start with a verb (e.g., "Add...", "Fix...", "Investigate...")
- Default story_type to "feature" unless the thread clearly describes a bug or maintenance task
- Only include labels that would genuinely help categorize the work
- Only set estimate if the thread has enough detail to size it; otherwise null
- Include all meaningful context from the thread in the description — the ticket should be understandable without reading the original Slack thread`;

function formatThread(messages: SlackMessage[]): string {
  return messages
    .map((m) => {
      const date = new Date(parseFloat(m.ts) * 1000);
      const time = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      let line = `@${m.user} (${time}): ${m.text}`;
      if (m.files && m.files.length > 0) {
        line += `\n  [Attached files: ${m.files.map((f) => f.name).join(", ")}]`;
      }
      return line;
    })
    .join("\n");
}

export async function generateTicket(
  messages: SlackMessage[]
): Promise<ShortcutTicket> {
  const transcript = formatThread(messages);

  const response = await callClaude(transcript);
  try {
    return parseTicket(response);
  } catch {
    // Retry once with a nudge
    const retryResponse = await callClaude(
      transcript +
        "\n\n[SYSTEM: Your previous response was not valid JSON. Please respond with ONLY valid JSON, no markdown fences or extra text.]"
    );
    return parseTicket(retryResponse);
  }
}

async function callClaude(userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }
  return block.text;
}

function parseTicket(raw: string): ShortcutTicket {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.name || !parsed.description || !parsed.story_type) {
    throw new Error("Missing required fields in ticket response");
  }

  return {
    name: parsed.name,
    description: parsed.description,
    story_type: parsed.story_type,
    labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    estimate: parsed.estimate ?? null,
  };
}
