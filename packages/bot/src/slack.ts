import { WebClient } from "@slack/web-api";
import type { SlackMessage } from "./types.js";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function fetchThread(
  channel: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const result = await slack.conversations.replies({
    channel,
    ts: threadTs,
    limit: 200,
  });

  if (!result.messages || result.messages.length === 0) {
    throw new Error("Could not fetch thread messages");
  }

  const parentMessage = result.messages[0];

  // If the message has a thread_ts different from its own ts,
  // it's a reply — fetch the full thread from the parent
  if (parentMessage.thread_ts && parentMessage.thread_ts !== threadTs) {
    const fullThread = await slack.conversations.replies({
      channel,
      ts: parentMessage.thread_ts,
      limit: 200,
    });

    if (!fullThread.messages || fullThread.messages.length === 0) {
      throw new Error("Could not fetch full thread messages");
    }

    return mapMessages(fullThread.messages);
  }

  // Handle pagination for long threads
  let allMessages = result.messages;
  let cursor = result.response_metadata?.next_cursor;

  while (cursor) {
    const page = await slack.conversations.replies({
      channel,
      ts: threadTs,
      cursor,
      limit: 200,
    });
    if (page.messages) {
      allMessages = allMessages.concat(page.messages);
    }
    cursor = page.response_metadata?.next_cursor;
  }

  return mapMessages(allMessages);
}

function mapMessages(
  messages: NonNullable<
    Awaited<ReturnType<typeof slack.conversations.replies>>["messages"]
  >
): SlackMessage[] {
  return messages.map((m) => ({
    user: m.user ?? "unknown",
    text: m.text ?? "",
    ts: m.ts ?? "",
    files: m.files?.map((f) => ({
      name: f.name ?? "unnamed",
      mimetype: f.mimetype ?? "unknown",
    })),
  }));
}

export async function postThreadReply(
  channel: string,
  threadTs: string,
  text: string
): Promise<void> {
  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text,
  });
}

export async function getPermalink(
  channel: string,
  messageTs: string
): Promise<string> {
  const result = await slack.chat.getPermalink({
    channel,
    message_ts: messageTs,
  });
  return result.permalink ?? "";
}

export async function getBotUserId(): Promise<string> {
  const result = await slack.auth.test();
  return result.user_id ?? "";
}
