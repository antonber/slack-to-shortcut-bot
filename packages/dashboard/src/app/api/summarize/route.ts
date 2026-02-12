import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRegistry, getTimeRange } from "@/lib/integrations";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { range?: string };
    const range = body.range ?? "week";
    const timeRange = getTimeRange(range);
    const registry = getRegistry();

    const [events, allMetrics] = await Promise.all([
      registry.getActivityFeed(timeRange),
      registry.getSummaryMetrics(timeRange),
    ]);

    const dataContext = `
Time range: ${timeRange.since} to ${timeRange.until}

Metrics by integration:
${JSON.stringify(allMetrics, null, 2)}

Recent activity (${events.length} events):
${events
  .slice(0, 50)
  .map(
    (e) =>
      `- [${e.source}] ${e.type}: ${e.title} by ${e.actor} (${e.timestamp})`
  )
  .join("\n")}
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a project intelligence assistant. Summarize this team activity data into a concise, actionable overview. Highlight key trends, notable activity, and anything that might need attention. Keep it to 2-3 short paragraphs.\n\n${dataContext}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ summary: text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
