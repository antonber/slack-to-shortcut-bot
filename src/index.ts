import "dotenv/config";
import express from "express";
import crypto from "crypto";
import { AppMentionEvent } from "./types";
import { handleMention } from "./handler";

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

function dedupeKey(event: AppMentionEvent): string {
  return `${event.channel}:${event.event_ts}`;
}

function markProcessed(key: string): void {
  processedEvents.add(key);
  setTimeout(() => processedEvents.delete(key), 5 * 60 * 1000);
}

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

  const event = req.body?.event as AppMentionEvent | undefined;

  if (!event || event.type !== "app_mention") {
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

  handleMention(event).catch((err) => {
    console.error("Unhandled error in mention handler:", err);
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
