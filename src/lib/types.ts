/** Komari 1.3.0+ public RPC and live data types. */

export interface ThemeSettings {
  defaultAppearance?: "system" | "light" | "dark";
  assetCurrency?: AssetCurrency;
  enableBlur?: boolean;
  glassOpacity?: number;
  backgroundImage?: string;
  showStatsBar?: boolean;
  showOnline?: boolean;
  showAssets?: boolean;
  showTraffic?: boolean;
  showSpeed?: boolean;
  showCarrierPing?: boolean;
  telecomPingTaskName?: string;
  mobilePingTaskName?: string;
  unicomPingTaskName?: string;
}

export interface PublicInfo {
  sitename: string;
  description: string;
  theme_settings: ThemeSettings;
}

export interface MetricDefinition {
  name: string;
  retention_days: number;
}

export interface PingMetricTaskStats {
  entity_id: string;
  task_id: string;
  total: number;
  valid: number;
  loss: number;
  loss_approximate: boolean;
}

export interface PingMetricStatsResponse {
  stats: PingMetricTaskStats[];
}

export type TrafficLimitType = "sum" | "max" | "min" | "up" | "down";

export interface NodeData {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  disk_total: number;
  weight: number;
  price: number;
  billing_cycle: number;
  currency: string;
  expired_at: string | null;
  group: string;
  tags: string;
  public_remark?: string;
  traffic_limit: number;
  traffic_limit_type: TrafficLimitType;
  updated_at: string;
}

/** Nested live stats returned by Komari 1.3.0+ public APIs. */
export interface NodeStats {
  cpu: { usage: number };
  ram: { used: number };
  load: { load1: number; load5: number; load15: number };
  disk: { used: number };
  network: {
    up: number;
    down: number;
    totalUp: number;
    totalDown: number;
  };
  connections: { tcp: number; udp: number };
  uptime: number;
  process: number;
  message: string;
  updated_at: string;
}

/** Flattened live status used across UI */
export interface LiveStatus {
  time: string;
  cpu: number;
  ram: number;
  load: number;
  load5: number;
  load15: number;
  disk: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;
  connections_udp: number;
  online: boolean;
  uptime: number;
  message: string;
}

export type LiveStatusMap = Record<string, LiveStatus>;

/** Merged node for card rendering */
export interface DisplayNode extends NodeData {
  online: boolean;
  cpu: number;
  ram: number;
  disk: number;
  load: number;
  load5: number;
  load15: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  uptime: number;
  process: number;
  connections: number;
  connections_udp: number;
  message?: string;
  updated_at_live?: string;
}

export interface HistoryRecord {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
  net_in: number;
  net_out: number;
}

export interface PingRecord {
  task_id: number;
  time: string;
  value: number;
}

export interface PingTask {
  id: number;
  name: string;
}

export interface PingHistoryResponse {
  records: PingRecord[];
  tasks: PingTask[];
}

export type Appearance = "light" | "dark" | "system";
export const ASSET_CURRENCIES = [
  "CNY",
  "USD",
  "HKD",
  "EUR",
  "GBP",
  "JPY",
  "RUB",
  "CHF",
  "INR",
  "VND",
  "THB",
  "CAD",
] as const;
export type AssetCurrency = (typeof ASSET_CURRENCIES)[number];
export type Route =
  | { name: "home" }
  | { name: "instance"; uuid: string }
  | { name: "not-found" };
