import type { QueryClient } from "@tanstack/react-query";
import api, { getProgressSummary } from "../api";
import type { ProgressSummaryRead } from "../schemas/progress";
import type { TaskRead } from "../schemas/task";

/**
 * Shared fetchers for dashboard-critical React Query keys.
 * Used by Dashboard hydration + optional Login prefetch to avoid duplicate /tasks + /progress round-trips.
 */
export const DASHBOARD_QUERY_STALE_MS = 120_000;

/**
 * Mark every task- and progress-related query stale so the next fetch returns fresh API data.
 * Without this, Dashboard bootstrap can reuse a still-"fresh" `chartSlices` cache for up to
 * `DASHBOARD_QUERY_STALE_MS` after task create/update elsewhere (Add Task, category page, etc.).
 */
export async function invalidateTasksAndProgressCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["progress"] }),
  ]);
}

export async function fetchDashboardProgressWeek(): Promise<ProgressSummaryRead> {
  const res = await getProgressSummary("week");
  return res.data;
}

export async function fetchDashboardTasksFullList(): Promise<TaskRead[]> {
  const { data } = await api.get<TaskRead[]>("/tasks");
  return Array.isArray(data) ? data : [];
}
