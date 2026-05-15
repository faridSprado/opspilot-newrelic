export type NewRelicRegion = 'US' | 'EU';

export type TimeRange = {
  since: string;
  until?: string | null;
  timezone?: string | null;
  step?: string | null;
};

export type AccountSummary = {
  id: number;
  name?: string | null;
};

export type CredentialSession = {
  profile_id: string;
  label?: string | null;
  region?: NewRelicRegion | null;
  account_ids?: number[];
  accounts?: AccountSummary[];
  persisted?: boolean;
  masked_api_key?: string;
};

export type EntitySummary = {
  guid: string;
  account_id?: number | null;
  name: string;
  type?: string | null;
  domain?: string | null;
  language?: string | null;
  alert_severity?: string | null;
  health_status?: string | null;
  permalink?: string | null;
  reporting?: boolean | null;
  transaction_event_type?: string | null;
  transaction_name_attribute?: string | null;
  data_sources?: Array<{ event_type: string; count: number }>;
  tags?: Array<{ key: string; values: string[] }>;
};

export type ChartSpec = {
  id: string;
  type: 'line' | 'area' | 'bar' | 'stacked_bar' | 'pie' | 'donut' | 'scatter' | 'heatmap' | 'table' | 'metric_cards' | 'timeline';
  title: string;
  subtitle?: string | null;
  description?: string | null;
  unit: string;
  x: { key: string; type: 'time' | 'category' | 'number'; label: string } | null;
  y: Array<{ key: string; label: string; unit: string; axis: 'left' | 'right' }>;
  series: Array<{ label: string; key: string; unit: string; axis: 'left' | 'right'; data: Array<{ x: string | number; y: number | null }> }>;
  rows: Array<Record<string, unknown>>;
  columns: Array<{ key: string; label: string; unit?: string }>;
  meta: Record<string, unknown> & { nrql?: string | null; dual_axis?: boolean; excluded_y_columns?: string[] };
};

export type ToolTraceItem = {
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
  duration_ms?: number | null;
  safe_output_preview: Record<string, unknown>;
};

export type ChatResponse = {
  ok: boolean;
  session_id: string;
  answer: string;
  tool_traces: ToolTraceItem[];
  visualizations: ChartSpec[];
  rows: Array<Record<string, unknown>>;
  entities?: EntitySummary[];
  action?: string | null;
  nrql?: string | null;
  suggestions: string[];
};

export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export type StoredChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatSessionSummary = {
  id: string;
  workspace_id?: string;
  title: string;
  selected_entity_guid?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string | null;
};
