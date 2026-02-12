import Anthropic from "@anthropic-ai/sdk";
import type { ToolRegistry } from "@mission-control/integrations";
import type { SlackMessage } from "./types.js";
import { buildSystemPrompt } from "./system-prompt.js";

const anthropic = new Anthropic();

const MAX_ITERATIONS = 15;

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

export async function runAgent(
  registry: ToolRegistry,
  messages: SlackMessage[],
  userInstruction: string
): Promise<string> {
  const transcript = formatThread(messages);
  const systemPrompt = buildSystemPrompt(registry);
  const tools = registry.getTools();

  const conversationMessages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the Slack thread for context:\n\n${transcript}\n\n---\n\nUser's request: ${userInstruction}`,
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: conversationMessages,
    });

    // Collect tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    // If Claude is done (no tool calls), extract and return the text
    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      return (
        textBlocks.map((b) => b.text).join("\n") ||
        "Done — no response text."
      );
    }

    // Claude wants to use tools — add its response to conversation
    conversationMessages.push({
      role: "assistant",
      content: response.content,
    });

    // Execute each tool via the registry and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await registry.executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    conversationMessages.push({ role: "user", content: toolResults });
  }

  return "I hit the maximum number of steps. Here's what I was able to do — please check the results.";
}
