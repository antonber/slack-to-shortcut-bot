import Link from "next/link";
import { getRegistry, getTimeRange } from "@/lib/integrations";
import { AiSummary } from "./components/AiSummary";
import { AlertsPanel } from "./components/AlertsPanel";

export const dynamic = "force-dynamic";

function RangeSelector({ current }: { current: string }) {
  const ranges = ["day", "week", "month"];
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {ranges.map((r) => (
        <Link
          key={r}
          href={`/?range=${r}`}
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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "week";
  const timeRange = getTimeRange(range);
  const registry = getRegistry();
  const [allMetrics, alerts] = await Promise.all([
    registry.getSummaryMetrics(timeRange),
    registry.getAlerts(timeRange),
  ]);

  const SOURCE_META: Record<string, { label: string; href: string; color: string }> = {
    shortcut: { label: "Shortcut", href: "/shortcut", color: "bg-purple-500" },
    github: { label: "GitHub", href: "/github", color: "bg-gray-800" },
    notion: { label: "Notion", href: "/notion", color: "bg-gray-600" },
    slack_data: { label: "Slack", href: "/activity", color: "bg-green-600" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <RangeSelector current={range} />
      </div>

      <AiSummary range={range} />

      <AlertsPanel alerts={alerts} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(allMetrics).map(([source, metrics]) => {
          const meta = SOURCE_META[source] ?? {
            label: source,
            href: "/",
            color: "bg-gray-500",
          };
          return (
            <Link
              key={source}
              href={meta.href}
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2.5 h-2.5 rounded-full ${meta.color}`} />
                <h2 className="text-lg font-semibold text-gray-900">
                  {meta.label}
                </h2>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-gray-500 uppercase tracking-wider">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900 mt-1">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Link>
          );
        })}

        {Object.keys(allMetrics).length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No integrations configured. Set environment variables to enable
            integrations.
          </div>
        )}
      </div>
    </div>
  );
}
