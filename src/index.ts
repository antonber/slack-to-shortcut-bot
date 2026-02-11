import "dotenv/config";
import express from "express";
import crypto from "crypto";
import { ReactionAddedEvent } from "./types";
import { handleTicketReaction } from "./handler";
import { getBotUserId } from "./slack";

const app = express();

// We need the raw body for signature verification
app.use(
  express.json({
    verify: (req: express.Request, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  })
);

// Slack request signature verification
function verifySlackSignature(req: express.Request): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers["x-slack-request-timestamp"] as string;
  const signature = req.headers["x-slack-signature"] as string;

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${(req as any).rawBody}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

// Duplicate detection: track processed events
const processedEvents = new Set<string>();

function dedupeKey(event: ReactionAddedEvent): string {
  return `${event.item.channel}:${event.item.ts}`;
}

function markProcessed(key: string): void {
  processedEvents.add(key);
  setTimeout(() => processedEvents.delete(key), 5 * 60 * 1000);
}

// Cache bot user ID
let botUserId: string | null = null;

app.post("/slack/events", async (req, res) => {
  // URL verification challenge
  if (req.body?.type === "url_verification") {
    return res.json({ challenge: req.body.challenge });
  }

  // Verify signature
  if (!verifySlackSignature(req)) {
    console.warn("Invalid Slack signature");
    return res.status(401).send("Invalid signature");
  }

  const event = req.body?.event as ReactionAddedEvent | undefined;

  if (!event || event.type !== "reaction_added") {
    return res.status(200).send("ok");
  }

  // Only handle :ticket: emoji
  if (event.reaction !== "ticket") {
    return res.status(200).send("ok");
  }

  // Ignore bot's own reactions
  if (!botUserId) {
    try {
      botUserId = await getBotUserId();
    } catch {
      // If we can't get bot ID, proceed anyway
    }
  }
  if (botUserId && event.user === botUserId) {
    return res.status(200).send("ok");
  }

  // Deduplicate
  const key = dedupeKey(event);
  if (processedEvents.has(key)) {
    return res.status(200).send("ok");
  }
  markProcessed(key);

  // Return 200 immediately, handle async
  res.status(200).send("ok");

  handleTicketReaction(event).catch((err) => {
    console.error("Unhandled error in ticket handler:", err);
  });
});

// Health check
app.get("/", (_req, res) => {
  res.send("Slack-to-Shortcut bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
