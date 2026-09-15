import {
  ASSET_CURRENCIES,
  type Appearance,
  type AssetCurrency,
  type ThemeSettings,
} from "./types";

const DEFAULT_THEME_SETTINGS: Required<
  Pick<
    ThemeSettings,
    | "defaultAppearance"
    | "assetCurrency"
    | "enableBlur"
    | "glassOpacity"
    | "textDarkness"
    | "backgroundImage"
    | "showStatsBar"
    | "showOnline"
    | "showAssets"
    | "showTraffic"
    | "showSpeed"
    | "showCarrierPing"
    | "telecomPingTaskName"
    | "mobilePingTaskName"
    | "unicomPingTaskName"
  >
> = {
  defaultAppearance: "system",
  assetCurrency: "CNY",
  enableBlur: true,
  glassOpacity: 60,
  textDarkness: 70,
  backgroundImage: "",
  showStatsBar: true,
  showOnline: true,
  showAssets: true,
  // 默认四项：在线 / 资产 / 累计流量 / 实时网速
  showTraffic: true,
  showSpeed: true,
  showCarrierPing: false,
  telecomPingTaskName: "",
  mobilePingTaskName: "",
  unicomPingTaskName: "",
};

export function mergeThemeSettings(
  raw: ThemeSettings | null | undefined
): typeof DEFAULT_THEME_SETTINGS {
  const src = raw ?? {};

  return {
    defaultAppearance: normalizeAppearance(
      src.defaultAppearance,
      DEFAULT_THEME_SETTINGS.defaultAppearance
    ),
    assetCurrency: normalizeAssetCurrency(
      src.assetCurrency,
      DEFAULT_THEME_SETTINGS.assetCurrency
    ),
    enableBlur: bool(src.enableBlur, DEFAULT_THEME_SETTINGS.enableBlur),
    glassOpacity: percent(
      src.glassOpacity,
      DEFAULT_THEME_SETTINGS.glassOpacity
    ),
    textDarkness: percent(
      src.textDarkness,
      DEFAULT_THEME_SETTINGS.textDarkness
    ),
    backgroundImage: String(
      src.backgroundImage ?? DEFAULT_THEME_SETTINGS.backgroundImage
    ),
    showStatsBar: bool(src.showStatsBar, DEFAULT_THEME_SETTINGS.showStatsBar),
    showOnline: bool(src.showOnline, DEFAULT_THEME_SETTINGS.showOnline),
    showAssets: bool(src.showAssets, DEFAULT_THEME_SETTINGS.showAssets),
    showTraffic: bool(src.showTraffic, DEFAULT_THEME_SETTINGS.showTraffic),
    showSpeed: bool(src.showSpeed, DEFAULT_THEME_SETTINGS.showSpeed),
    showCarrierPing: bool(
      src.showCarrierPing,
      DEFAULT_THEME_SETTINGS.showCarrierPing
    ),
    telecomPingTaskName: normalizePingTaskName(src.telecomPingTaskName),
    mobilePingTaskName: normalizePingTaskName(src.mobilePingTaskName),
    unicomPingTaskName: normalizePingTaskName(src.unicomPingTaskName),
  };
}

function normalizePingTaskName(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeAssetCurrency(
  value: unknown,
  fallback: AssetCurrency
): AssetCurrency {
  if (typeof value !== "string") return fallback;
  return (ASSET_CURRENCIES as readonly string[]).includes(value)
    ? (value as AssetCurrency)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function percent(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function normalizeAppearance(
  value: unknown,
  fallback: Appearance
): Appearance {
  if (value === "light" || value === "dark" || value === "system") return value;
  return fallback;
}

/** Parse "lightUrl|darkUrl" background config */
export function resolveBackground(
  raw: string,
  isDark: boolean
): string | null {
  if (!raw?.trim()) return null;
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length === 1) return parts[0] || null;
  return (isDark ? parts[1] || parts[0] : parts[0]) || null;
}

export const APPEARANCE_KEY = "appearance";
