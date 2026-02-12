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
}
