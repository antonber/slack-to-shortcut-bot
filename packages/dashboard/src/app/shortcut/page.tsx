import Link from "next/link";
import { getRegistry, getTimeRange } from "@/lib/integrations";

export const dynamic = "force-dynamic";

function RangeSelector({ current, base }: { current: string; base: string }) {
  const ranges = ["day", "week", "month"];
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {ranges.map((r) => (
        <Link
          key={r}
          href={`${base}?range=${r}`}
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

export default async function ShortcutPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "week";
  const timeRange = getTimeRange(range);
  const registry = getRegistry();

  const modules = registry.getModules();
  const shortcut = modules.find((m) => m.name === "shortcut");

  if (!shortcut) {
    return (
      <div className="text-center py-12 text-gray-500">
        Shortcut integration is not configured. Set SHORTCUT_API_TOKEN to
        enable.
      </div>
    );
  }

  const [metrics, events] = await Promise.all([
    shortcut.getSummaryMetrics(timeRange),
    shortcut.getActivityFeed(timeRange),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900">Shortcut</h1>
        </div>
        <RangeSelector current={range} base="/shortcut" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(metrics).map(([key, value]) => (
          <div
            key={key}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <dt className="text-xs text-gray-500 uppercase tracking-wider">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="text-3xl font-bold text-gray-900 mt-2">{value}</dd>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Activity
      </h2>
      <div className="bg-white rounded-lg border border-gray-200">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No activity in this time range.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.slice(0, 30).map((event) => (
              <li key={event.id} className="px-6 py-3">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-900 hover:text-purple-600"
                >
                  {event.title}
                </a>
                <p className="text-xs text-gray-500 mt-0.5">
                  {event.type.replace(/_/g, " ")} &middot; {event.actor}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
