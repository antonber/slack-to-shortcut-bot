import type { ToolRegistry } from "@mission-control/integrations";
import type { AppMentionEvent } from "./types.js";
import {
  fetchThread,
  postThreadReply,
  getPermalink,
  getBotUserId,
} from "./slack.js";
import { runAgent } from "./agent.js";

/**
 * Convert Markdown formatting to Slack mrkdwn.
 * Claude tends to output **bold** and ## headers despite prompt instructions.
 */
function markdownToSlackMrkdwn(text: string): string {
  return (
    text
      // Headers -> bold (### first, then ##, then #)
      .replace(/^#{1,3}\s+(.+)$/gm, "*$1*")
      // **bold** -> *bold* (but not inside URLs/links)
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      // [text](url) -> <url|text> (but skip if already in Slack link format)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
  );
}

export function createHandler(registry: ToolRegistry) {
  return async function handleMention(
    event: AppMentionEvent
  ): Promise<void> {
    const { channel } = event;
    const threadTs = event.thread_ts ?? event.ts;

    try {
      // 0. Acknowledge
      await postThreadReply(channel, threadTs, "\u{1F916} On it...");

      // 1. Strip bot mention from the user's message to get their instruction
      const botUserId = await getBotUserId();
      const userInstruction =
        event.text
          .replace(new RegExp(`<@${botUserId}>`, "g"), "")
          .trim() || "Create a ticket for this thread";

      // 2. Fetch thread context
      const messages = await fetchThread(channel, threadTs);

      // 3. Get permalink for Slack thread reference
      const permalink = await getPermalink(channel, threadTs);

      // 4. Run the agent
      let response = await runAgent(registry, messages, userInstruction);

      // 5. Replace any Slack URL placeholders the agent may have used
      response = response.replace(/\{\{SLACK_THREAD_URL\}\}/g, permalink);

      // 6. Convert Markdown -> Slack mrkdwn (Claude sometimes ignores prompt instructions)
      response = markdownToSlackMrkdwn(response);

      // 7. Post the agent's response
      await postThreadReply(channel, threadTs, response);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Agent error:", error);

      try {
        await postThreadReply(
          channel,
          threadTs,
          `\u274C Something went wrong: ${reason}`
        );
      } catch (replyError) {
        console.error("Failed to post error reply:", replyError);
      }
    }
  };
}
