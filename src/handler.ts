import { ReactionAddedEvent } from "./types";
import { fetchThread, postThreadReply, getPermalink } from "./slack";
import { generateTicket } from "./agent";
import { createStory } from "./shortcut";

export async function handleTicketReaction(
  event: ReactionAddedEvent
): Promise<void> {
  const { channel, ts } = event.item;

  try {
    // 1. Fetch the thread
    const messages = await fetchThread(channel, ts);

    // 2. Generate ticket via Claude
    const ticket = await generateTicket(messages);

    // 3. Get Slack thread permalink
    const permalink = await getPermalink(channel, ts);

    // 4. Replace placeholder in description
    ticket.description = ticket.description.replace(
      /\{\{SLACK_THREAD_URL\}\}/g,
      permalink
    );

    // 5. Create Shortcut story
    const story = await createStory(ticket);

    // 6. Reply in thread
    const estimate =
      ticket.estimate !== null ? `${ticket.estimate}pt` : "Unestimated";
    const reply =
      `✅ Shortcut ticket created: *${ticket.name}*\n` +
      `${story.url}\n` +
      `Type: ${ticket.story_type} · Estimate: ${estimate}`;

    await postThreadReply(channel, ts, reply);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create ticket:", error);

    try {
      await postThreadReply(
        channel,
        ts,
        `❌ Failed to create ticket: ${reason}`
      );
    } catch (replyError) {
      console.error("Failed to post error reply:", replyError);
    }
  }
}
