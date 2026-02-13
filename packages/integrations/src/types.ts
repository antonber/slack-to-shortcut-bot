import type Anthropic from "@anthropic-ai/sdk";

/** Unified time range for dashboard queries */
export interface TimeRange {
  since: string;
  until: string;
}

/** Common activity event, normalized across all sources */
export interface ActivityEvent {
  id: string;
  source: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  url: string;
  metadata: Record<string, unknown>;
}

/** A single item within an alert (e.g. a stuck story, a stale PR) */
export interface AlertItem {
  id: string;
  title: string;
  url: string;
  metadata: Record<string, unknown>;
}

/** An actionable alert surfaced by an integration */
export interface Alert {
  id: string;
  source: string;
  severity: "warning" | "info";
  title: string;
  description: string;
  items: AlertItem[];
  timestamp: string;
}

/** Every integration module must conform to this interface */
export interface IntegrationModule {
  name: string;
  description: string;
  isConfigured: () => boolean;

  // Agent tools (for bot)
  tools: Anthropic.Tool[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>;

  // Dashboard reads (typed, structured)
  getActivityFeed: (range: TimeRange) => Promise<ActivityEvent[]>;
  getSummaryMetrics: (range: TimeRange) => Promise<Record<string, number>>;
  getAlerts?: (range: TimeRange) => Promise<Alert[]>;
}
