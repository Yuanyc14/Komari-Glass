"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPingHistory, fetchPingMetricStats } from "@/lib/api";
import {
  getExactPingLossByTask,
  summarizePingRecords,
} from "@/lib/ping";
import type {
  PingHistoryResponse,
  PingMetricTaskStats,
  PingTask,
} from "@/lib/types";

interface PingBar {
  key: string;
  className: string;
  tooltip: string;
}

export interface PingTaskSelection {
  telecom: string;
  mobile: string;
  unicom: string;
}

export interface NodePingTaskRow {
  id: number;
  label: string;
  name: string;
  color: string;
  latencyDisplay: string;
  lossDisplay: string;
  latencyBars: PingBar[];
  lossBars: PingBar[];
}

interface NodePingStats {
  tasks: NodePingTaskRow[];
  latencyDisplay: string;
  lossDisplay: string;
  latencyBars: PingBar[];
  lossBars: PingBar[];
  loading: boolean;
}

interface PingData {
  history: PingHistoryResponse;
  metricStats: PingMetricTaskStats[];
}

interface CacheEntry {
  at: number;
  data?: PingData;
  promise?: Promise<PingData>;
}

const MAX_POINTS = 6000;
const BAR_COUNT = 20;
const CACHE_TTL = 60_000;
const REFRESH_INTERVAL = 60_000;
const cache = new Map<string, CacheEntry>();

const PING_SLOTS = [
  {
    key: "mobile",
    label: "移动",
    color: "#34d399",
    aliases: ["移动", "chinamobile", "mobile", "cmcc"],
  },
  {
    key: "unicom",
    label: "联通",
    color: "#60a5fa",
    aliases: ["联通", "chinaunicom", "unicom", "cucc"],
  },
  {
    key: "telecom",
    label: "电信",
    color: "#fb7185",
    aliases: ["电信", "chinatelecom", "telecom", "ctcc"],
  },
] as const;

function normalizeTaskName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "");
}

function selectAutomaticPingTasks(
  tasks: PingTask[],
  validTaskIds: Set<number>
): Map<keyof PingTaskSelection, PingTask> {
  const available = tasks
    .filter((task) => validTaskIds.has(task.id))
    .map((task) => ({ task, normalizedName: normalizeTaskName(task.name) }));
  const selected = new Map<keyof PingTaskSelection, PingTask>();
  const usedTaskIds = new Set<number>();

  for (const slot of PING_SLOTS) {
    const match = available.find(
      (candidate) =>
        !usedTaskIds.has(candidate.task.id) &&
        slot.aliases.some((alias) => candidate.normalizedName.includes(alias))
    );
    if (!match) continue;
    selected.set(slot.key, match.task);
    usedTaskIds.add(match.task.id);
  }

  for (const slot of PING_SLOTS) {
    if (selected.has(slot.key)) continue;
    const match = available.find(
      (candidate) => !usedTaskIds.has(candidate.task.id)
    );
    if (!match) break;
    selected.set(slot.key, match.task);
    usedTaskIds.add(match.task.id);
  }

  return selected;
}

async function fetchPingData(uuid: string, hours: number): Promise<PingData> {
  const [history, stats] = await Promise.all([
    fetchPingHistory(uuid, hours),
    fetchPingMetricStats(uuid, hours, MAX_POINTS).catch(() => null),
  ]);
  return {
    history,
    metricStats: stats?.stats ?? [],
  };
}

async function loadPingData(
  uuid: string,
  hours: number,
  force = false
): Promise<PingData> {
  const key = `${uuid}:${hours}`;
  const hit = cache.get(key);
  if (hit?.promise) return hit.promise;
  if (!force && hit?.data && Date.now() - hit.at < CACHE_TTL) {
    return hit.data;
  }

  const promise = fetchPingData(uuid, hours)
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch((error) => {
      if (hit?.data) {
        cache.set(key, { at: hit.at, data: hit.data });
        return hit.data;
      }
      cache.delete(key);
      throw error;
    });

  cache.set(key, { at: hit?.at ?? 0, data: hit?.data, promise });
  return promise;
}

function latencyClass(ms: number): string {
  if (ms <= 60) return "bg-signal-1";
  if (ms <= 100) return "bg-signal-2";
  if (ms <= 160) return "bg-signal-3";
  if (ms <= 200) return "bg-signal-4";
  return "bg-signal-5";
}

function lossClass(percent: number): string {
  if (percent <= 1) return "bg-signal-1";
  if (percent <= 3) return "bg-signal-2";
  if (percent <= 6) return "bg-signal-3";
  if (percent <= 9) return "bg-signal-4";
  return "bg-signal-5";
}

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyBars(label: string): PingBar[] {
  return Array.from({ length: BAR_COUNT }, (_, index) => ({
    key: `empty-${index}`,
    className: "bg-muted-foreground/10",
    tooltip: label,
  }));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function useNodePingStats(
  uuid: string,
  enabled = true,
  hours = 1,
  selection: PingTaskSelection | null = null
): NodePingStats {
  const [data, setData] = useState<PingData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !uuid) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setData(null);
    setLoading(true);

    const loadInitial = async () => {
      try {
        const result = await loadPingData(uuid, hours);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const refresh = async () => {
      try {
        const result = await loadPingData(uuid, hours, true);
        if (!cancelled) setData(result);
      } catch {
        // Preserve the most recent successful result during transient failures.
      }
    };

    void loadInitial();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [uuid, enabled, hours]);

  const stats = useMemo<NodePingStats>(() => {
    if (!data) {
      const label = loading ? "加载中" : "无采样数据";
      return {
        tasks: [],
        latencyDisplay: loading ? "加载中" : "-",
        lossDisplay: loading ? "加载中" : "-",
        latencyBars: emptyBars(label),
        lossBars: emptyBars(label),
        loading,
      };
    }

    const recordStats = summarizePingRecords(
      data.history.records,
      selection !== null
    );
    const summaries = new Map(
      recordStats.tasks.map((summary) => [
        summary.taskId,
        summary,
      ])
    );
    const exactLoss = getExactPingLossByTask(uuid, data.metricStats);
    const configured = selection
      ? PING_SLOTS.map((slot) => ({
          ...slot,
          taskName: selection[slot.key].trim(),
        }))
      : [];
    const configuredMode = configured.some((slot) => slot.taskName !== "");
    const usedTaskIds = new Set<number>();
    const automaticTasks = selection && !configuredMode
      ? selectAutomaticPingTasks(
          data.history.tasks,
          new Set(summaries.keys())
        )
      : null;
    const taskMap = new Map<string, PingTask>();
    if (configuredMode) {
      for (const task of data.history.tasks) {
        const name = task.name.trim();
        if (name && !taskMap.has(name)) taskMap.set(name, task);
      }
    }

    const selected = !selection
      ? []
      : configuredMode
      ? configured.flatMap((slot) => {
          if (!slot.taskName) return [];
          const task = taskMap.get(slot.taskName);
          if (!task || usedTaskIds.has(task.id)) return [];
          const summary = summaries.get(task.id);
          if (!summary) return [];
          usedTaskIds.add(task.id);
          return [{
            task,
            summary,
            label: slot.label,
            color: slot.color,
          }];
        })
      : PING_SLOTS.flatMap((slot) => {
          const task = automaticTasks?.get(slot.key);
          if (!task) return [];
          const summary = summaries.get(task.id);
          if (!summary) return [];
          return [{
            task,
            summary,
            label: slot.label,
            color: slot.color,
          }];
        });

    const tasks = selected.map<NodePingTaskRow>(
      ({ task, summary, label, color }) => ({
        id: task.id,
        label,
        name: task.name,
        color,
        latencyDisplay: `${Math.round(summary.latestLatency)} ms`,
        lossDisplay: `${(exactLoss.get(task.id) ?? summary.loss).toFixed(1)}%`,
        latencyBars: summary.history.map((point, index) => ({
          key: `latency-${task.id}-${point.time}-${index}`,
          className:
            point.latency === null
              ? "bg-muted-foreground/15"
              : latencyClass(point.latency),
          tooltip:
            point.latency === null
              ? `${formatTime(point.time)}\n无采样数据`
              : `${formatTime(point.time)}\n${Math.round(point.latency)} ms`,
        })),
        lossBars: summary.history.map((point, index) => ({
          key: `loss-${task.id}-${point.time}-${index}`,
          className:
            point.loss === null
              ? "bg-muted-foreground/15"
              : lossClass(point.loss),
          tooltip:
            point.loss === null
              ? `${formatTime(point.time)}\n无采样数据`
              : `${formatTime(point.time)}\n${point.loss.toFixed(1)}%`,
        })),
      })
    );
    const exactLossValues = recordStats.tasks.map(
      (summary) => exactLoss.get(summary.taskId) ?? summary.loss
    );
    const aggregateHistory = recordStats.history;

    return {
      tasks,
      latencyDisplay: recordStats.hasData
        ? `${Math.round(recordStats.avgLatency)} ms`
        : "-",
      lossDisplay: recordStats.hasData
        ? `${average(exactLossValues).toFixed(1)}%`
        : "-",
      latencyBars: aggregateHistory.length
        ? aggregateHistory.map((point, index) => ({
            key: `latency-${point.time}-${index}`,
            className:
              point.latency === null
                ? "bg-muted-foreground/15"
                : latencyClass(point.latency),
            tooltip:
              point.latency === null
                ? `${formatTime(point.time)}\n无采样数据`
                : `${formatTime(point.time)}\n${Math.round(point.latency)} ms`,
          }))
        : emptyBars("无采样数据"),
      lossBars: aggregateHistory.length
        ? aggregateHistory.map((point, index) => ({
            key: `loss-${point.time}-${index}`,
            className:
              point.loss === null
                ? "bg-muted-foreground/15"
                : lossClass(point.loss),
            tooltip:
              point.loss === null
                ? `${formatTime(point.time)}\n无采样数据`
                : `${formatTime(point.time)}\n${point.loss.toFixed(1)}%`,
          }))
        : emptyBars("无采样数据"),
      loading,
    };
  }, [
    data,
    loading,
    selection?.telecom,
    selection?.mobile,
    selection?.unicom,
    uuid,
  ]);

  return stats;
}
