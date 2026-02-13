import type { Alert } from "@mission-control/integrations";

function AlertCard({ alert }: { alert: Alert }) {
  const isWarning = alert.severity === "warning";
  const borderColor = isWarning ? "border-amber-200" : "border-blue-200";
  const bgColor = isWarning ? "bg-amber-50" : "bg-blue-50";
  const titleColor = isWarning ? "text-amber-800" : "text-blue-800";
  const badgeColor = isWarning
    ? "bg-amber-100 text-amber-700"
    : "bg-blue-100 text-blue-700";

  const MAX_ITEMS = 5;
  const visibleItems = alert.items.slice(0, MAX_ITEMS);
  const remaining = alert.items.length - MAX_ITEMS;

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`text-sm font-semibold ${titleColor}`}>
              {alert.title}
            </h3>
            <span
              className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${badgeColor}`}
            >
              {alert.source}
            </span>
          </div>
          <p className="text-xs text-gray-600">{alert.description}</p>
        </div>
      </div>

      {visibleItems.length > 0 && (
        <ul className="mt-3 space-y-1">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${titleColor} hover:underline truncate block`}
              >
                {item.title}
              </a>
            </li>
          ))}
          {remaining > 0 && (
            <li className="text-xs text-gray-500">
              +{remaining} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
