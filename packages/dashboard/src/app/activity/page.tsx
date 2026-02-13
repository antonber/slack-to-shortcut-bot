import Link from "next/link";
import { getRegistry, getTimeRange } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const SOURCE_COLORS: Record<string, string> = {
  shortcut: "bg-purple-100 text-purple-800",
  github: "bg-gray-100 text-gray-800",
  notion: "bg-blue-100 text-blue-800",
  slack: "bg-green-100 text-green-800",
};

function RangeSelector({ current }: { current: string }) {
  const ranges = ["day", "week", "month"];
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {ranges.map((r) => (
        <Link
          key={r}
          href={`/activity?range=${r}`}
          className={`px-3 py-1.5 text-sm rounded-md ${
            current === r
              ? "bg-white text-gray-900 shadow-sm font-medium"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {r === "day" ? "Today" : r === "week" ? "This week" : "This month"}
        </Link>
      ))}
    </div>
  );
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ShortcutBadges({ linkedStories }: { linkedStories: number[] }) {
  if (linkedStories.length === 0) return null;
  return (
    <span className="inline-flex gap-1 ml-2">
      {linkedStories.map((id) => (
        <a
          key={id}
          href={`https://app.shortcut.com/story/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
        >
          sc-{id}
        </a>
      ))}
    </span>
  );
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "week";
  const timeRange = getTimeRange(range);
  const registry = getRegistry();
  const events = await registry.getActivityFeed(timeRange);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <RangeSelector current={range} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No activity found for this time range.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((event) => {
              const linkedStories = Array.isArray(event.metadata?.linkedStories)
                ? (event.metadata.linkedStories as number[])
                : [];
              return (
                <li key={event.id} className="px-6 py-4">
                  <div className="flex items-start gap-4">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full mt-0.5 ${
                        SOURCE_COLORS[event.source] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {event.source}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                          >
                            {event.title}
                          </a>
                          <ShortcutBadges linkedStories={linkedStories} />
                        </span>
                        <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {event.description} &middot; {event.actor}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
