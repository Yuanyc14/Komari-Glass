"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMetricDefinitions,
  fetchNodes,
  fetchPublicInfo,
} from "@/lib/api";
import {
  exchangeRatesEqual,
  FALLBACK_EXCHANGE_RATES,
  getCachedExchangeRates,
  refreshExchangeRatesIfNeeded,
  type ExchangeRates,
} from "@/lib/exchange-rates";
import { calcOverview, mergeNodes } from "@/lib/metrics";
import { navigate, parsePath, toPath } from "@/lib/router";
import {
  APPEARANCE_KEY,
  mergeThemeSettings,
  resolveBackground,
} from "@/lib/theme-settings";
import { getLiveWebSocket } from "@/lib/websocket";
import type {
  Appearance,
  DisplayNode,
  LiveStatusMap,
  MetricDefinition,
  NodeData,
  PublicInfo,
  Route,
} from "@/lib/types";

interface AppContextValue {
  loading: boolean;
  error: string | null;
  publicInfo: PublicInfo | null;
  nodes: DisplayNode[];
  metricRetention: MetricRetention;
  overview: ReturnType<typeof calcOverview>;
  settings: ReturnType<typeof mergeThemeSettings>;
  appearance: Appearance;
  resolvedTheme: "light" | "dark";
  setAppearance: (a: Appearance) => void;
  route: Route;
  goHome: () => void;
  goInstance: (uuid: string) => void;
  refresh: () => Promise<void>;
  sitename: string;
}

interface MetricRetention {
  loadHours: number;
  pingHours: number;
}

const LOAD_METRIC_KEYS = [
  "cpu.usage",
  "memory.used",
  "disk.used",
  "net.in.rate",
  "net.out.rate",
] as const;

function mixHex(color: string, target: string, percentage: number): string {
  const amount = Math.min(100, Math.max(0, percentage)) / 100;
  const sourceChannels = color.replace("#", "").match(/.{2}/g);
  const targetChannels = target.replace("#", "").match(/.{2}/g);

  if (!sourceChannels || !targetChannels) return color;

  const channels = sourceChannels.map((channel, index) => {
    const sourceValue = Number.parseInt(channel, 16);
    const targetValue = Number.parseInt(targetChannels[index], 16);
    return Math.round(sourceValue + (targetValue - sourceValue) * amount)
      .toString(16)
      .padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

function getRetentionHours(
  definitions: MetricDefinition[],
  names: readonly string[]
): number {
  const byName = new Map(
    definitions.map((definition) => [definition.name, definition.retention_days])
  );
  return Math.min(...names.map((name) => byName.get(name) ?? 0)) * 24;
}

function resolveMetricRetention(
  definitions: MetricDefinition[]
): MetricRetention {
  return {
    loadHours: getRetentionHours(definitions, LOAD_METRIC_KEYS),
    pingHours: getRetentionHours(definitions, ["ping.latency_ms"]),
  };
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredAppearance(fallback: Appearance): Appearance {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(APPEARANCE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return fallback;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [rawNodes, setRawNodes] = useState<NodeData[]>([]);
  const [liveMap, setLiveMap] = useState<LiveStatusMap | null>(null);
  const [metricRetention, setMetricRetention] = useState<MetricRetention>({
    loadHours: 0,
    pingHours: 0,
  });
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(
    FALLBACK_EXCHANGE_RATES
  );
  const themeSwitchFrame = useRef<number | null>(null);

  const settings = useMemo(
    () => mergeThemeSettings(publicInfo?.theme_settings),
    [publicInfo]
  );

  const resolvedTheme: "light" | "dark" =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;

  const setAppearance = useCallback((a: Appearance) => {
    const root = document.documentElement;
    const nextTheme =
      a === "system" ? (getSystemDark() ? "dark" : "light") : a;

    root.dataset.themeSwitching = "true";
    root.classList.toggle("dark", nextTheme === "dark");
    root.style.colorScheme = nextTheme;

    if (themeSwitchFrame.current !== null) {
      cancelAnimationFrame(themeSwitchFrame.current);
    }
    themeSwitchFrame.current = requestAnimationFrame(() => {
      themeSwitchFrame.current = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
        themeSwitchFrame.current = null;
      });
    });

    setAppearanceState(a);
    try {
      localStorage.setItem(APPEARANCE_KEY, a);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [pub, nodes, metricDefinitions] = await Promise.all([
        fetchPublicInfo(),
        fetchNodes(),
        fetchMetricDefinitions(),
      ]);
      setPublicInfo(pub);
      setRawNodes(nodes);
      setMetricRetention(resolveMetricRetention(metricDefinitions));

      // init appearance from localStorage or theme default
      const defaults = mergeThemeSettings(pub.theme_settings);
      setAppearanceState(readStoredAppearance(defaults.defaultAppearance));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // bootstrap
  useEffect(() => {
    setSystemDark(getSystemDark());
    setRoute(parsePath(window.location.pathname));
    void refresh();

    const onPop = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener("popstate", onPop);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", onScheme);

    return () => {
      window.removeEventListener("popstate", onPop);
      mql.removeEventListener("change", onScheme);
      if (themeSwitchFrame.current !== null) {
        cancelAnimationFrame(themeSwitchFrame.current);
      }
      delete document.documentElement.dataset.themeSwitching;
    };
  }, [refresh]);

  // Cache one exchange-rate request per local calendar day and refresh
  // long-lived tabs when they become active.
  useEffect(() => {
    let active = true;

    const applyRates = (next: ExchangeRates | null) => {
      if (!active || !next) return;
      setExchangeRates((current) =>
        exchangeRatesEqual(current, next) ? current : next
      );
    };
    const syncRates = () => {
      void refreshExchangeRatesIfNeeded().then(applyRates);
    };

    applyRates(getCachedExchangeRates());
    syncRates();

    const interval = window.setInterval(syncRates, 60 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncRates();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // live websocket
  useEffect(() => {
    if (loading) return;
    const ws = getLiveWebSocket();
    const unsub = ws.subscribe(setLiveMap);
    ws.connect();
    return () => {
      unsub();
      ws.disconnect();
    };
  }, [loading]);

  // apply dark class + background
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;

    const bg = resolveBackground(settings.backgroundImage, resolvedTheme === "dark");
    const el = document.getElementById("theme-background");
    if (el) {
      if (bg) {
        el.style.backgroundImage = `url(${JSON.stringify(bg)})`;
        el.style.opacity = "1";
      } else {
        el.style.backgroundImage = "";
        el.style.opacity = "0";
      }
    }

    root.dataset.blur = settings.enableBlur ? "on" : "off";
    root.dataset.textBold = settings.enableTextBold ? "on" : "off";

    const isDark = resolvedTheme === "dark";
    const contrastTarget = isDark ? "#ffffff" : "#000000";
    const foregroundBase = isDark ? "#f3f6f5" : "#11191f";
    const mutedForegroundBase = isDark ? "#9fa9a7" : "#59666f";
    root.style.setProperty(
      "--foreground",
      mixHex(foregroundBase, contrastTarget, settings.textDarkness)
    );
    root.style.setProperty(
      "--card-foreground",
      mixHex(foregroundBase, contrastTarget, settings.textDarkness)
    );
    root.style.setProperty(
      "--muted-foreground",
      mixHex(mutedForegroundBase, contrastTarget, settings.textDarkness)
    );

    const opacity = settings.glassOpacity / 100;
    root.style.setProperty("--glass-opacity", opacity.toFixed(2));
    root.style.setProperty(
      "--glass-hover-opacity",
      Math.min(1, opacity + 0.08).toFixed(2)
    );
    root.style.setProperty(
      "--glass-control-opacity",
      Math.min(1, opacity + 0.04).toFixed(2)
    );
    root.style.setProperty(
      "--glass-data-opacity",
      (opacity * 0.08).toFixed(3)
    );
  }, [
    resolvedTheme,
    settings.backgroundImage,
    settings.enableBlur,
    settings.enableTextBold,
    settings.glassOpacity,
    settings.textDarkness,
  ]);

  // Komari's admin node list stores its drag-and-drop order in `weight`.
  const nodes = useMemo(
    () =>
      mergeNodes(rawNodes, liveMap).sort((a, b) => a.weight - b.weight),
    [rawNodes, liveMap]
  );

  const overview = useMemo(
    () => calcOverview(nodes, settings.assetCurrency, exchangeRates),
    [nodes, settings.assetCurrency, exchangeRates]
  );

  const goHome = useCallback(() => {
    navigate({ name: "home" });
  }, []);

  const goInstance = useCallback((uuid: string) => {
    navigate({ name: "instance", uuid });
  }, []);

  // keep document title in sync
  useEffect(() => {
    if (publicInfo?.sitename) {
      // Komari already injects title; keep soft sync for SPA navigations
      if (route.name === "instance") {
        const node = nodes.find((n) => n.uuid === route.uuid);
        if (node) {
          document.title = `${node.name} · ${publicInfo.sitename}`;
          return;
        }
      }
      document.title = publicInfo.sitename;
    }
  }, [publicInfo, route, nodes]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route]);

  // ensure path canonical
  useEffect(() => {
    if (typeof window === "undefined") return;
    const expected = toPath(route);
    if (window.location.pathname !== expected && route.name !== "not-found") {
      // don't force-replace when path is already fine with trailing slash variants
      const current = window.location.pathname.replace(/\/+$/, "") || "/";
      const want = expected.replace(/\/+$/, "") || "/";
      if (current !== want) {
        window.history.replaceState({ route }, "", expected);
      }
    }
  }, [route]);

  const value: AppContextValue = {
    loading,
    error,
    publicInfo,
    nodes,
    metricRetention,
    overview,
    settings,
    appearance,
    resolvedTheme,
    setAppearance,
    route,
    goHome,
    goInstance,
    refresh,
    sitename: publicInfo?.sitename || "Komari Monitor",
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

