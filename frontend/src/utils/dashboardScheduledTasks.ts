/**
 * Which local dashboard tasks are scheduled on a weekday (0=Sun … 6=Sat).
 * Does not filter by completion — use with `!task.completed` for the active list.
 */
import type { Task } from "../app/types";
import { addDaysLocal, formatLocalDateKey, parseDateKeyLocal } from "./dashboardWeekFormat";

/** Deterministic day slot for weekly/monthly-style tasks (same hash as WeeklyCalendarStrip). */
export function stableDayIndexForTask(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0;
  return hash % 7;
}

/**
 * Whether this task appears on the selected calendar cell (YYYY-MM-DD), e.g. Google-primary week day.
 * - Daily: every calendar day.
 * - Weekly: fixed weekday (0=Sun … 6=Sat) derived from task id; matched to the cell’s weekday.
 * - Monthly: `monthlyDayOfMonth` from API when set; else day-of-month (1–28) derived from task id.
 * - `deferredUntilDateKey`: one-shot; task only appears on that YYYY-MM-DD.
 */
export function taskScheduledOnDateKey(task: Task, cellDateKey: string): boolean {
  const cellDate = parseDateKeyLocal(cellDateKey);
  if (!cellDate) return false;
  if (task.deferredUntilDateKey) {
    return cellDateKey === task.deferredUntilDateKey;
  }
  if (task.frequency === "daily") return true;
  if (task.frequency === "weekly") {
    const dow = cellDate.getDay();
    return stableDayIndexForTask(String(task.id)) === dow;
  }
  if (task.frequency === "monthly") {
    const dayOfMonth = cellDate.getDate();
    const fromApi = task.monthlyDayOfMonth;
    const anchorDom =
      typeof fromApi === "number" && fromApi >= 1 && fromApi <= 31
        ? fromApi
        : (stableDayIndexForTask(`monthly:${task.id}`) % 28) + 1;
    return dayOfMonth === anchorDom;
  }
  return false;
}

/**
 * @deprecated Prefer `taskScheduledOnDateKey` when the strip is driven by explicit YYYY-MM-DD keys.
 */
export function taskScheduledOnWeekday(task: Task, dayIndex: number, weekStartSunday: Date): boolean {
  const cellDate = addDaysLocal(weekStartSunday, dayIndex);
  return taskScheduledOnDateKey(task, formatLocalDateKey(cellDate));
}

/** Pending tasks for the selected calendar day key. */
export function filterPendingTasksForDateKey(tasks: Task[], cellDateKey: string): Task[] {
  return tasks.filter((t) => !t.completed && taskScheduledOnDateKey(t, cellDateKey));
}

/** Pending tasks for the selected weekday, all rooms aggregated. */
export function filterPendingTasksForSelectedDay(tasks: Task[], dayIndex: number, weekStartSunday: Date): Task[] {
  const cellDate = addDaysLocal(weekStartSunday, dayIndex);
  return filterPendingTasksForDateKey(tasks, formatLocalDateKey(cellDate));
}

/** How many incomplete tasks are scheduled on this calendar day key. */
export function countPendingTasksForDateKey(tasks: Task[], cellDateKey: string): number {
  return tasks.filter((t) => !t.completed && taskScheduledOnDateKey(t, cellDateKey)).length;
}

/** How many incomplete tasks are scheduled on this weekday index (0=Sun … 6=Sat). */
export function countPendingTasksForWeekday(tasks: Task[], dayIndex: number, weekStartSunday: Date): number {
  const cellDate = addDaysLocal(weekStartSunday, dayIndex);
  return countPendingTasksForDateKey(tasks, formatLocalDateKey(cellDate));
}

/** Drop deferrals that belong to a week before the visible week start (YYYY-MM-DD, Sunday key). */
export function stripExpiredTaskDeferrals(tasks: Task[], weekStartDateKey: string): Task[] {
  return tasks.map((t) => {
    if (!t.deferredUntilDateKey) return t;
    if (t.deferredUntilDateKey < weekStartDateKey) {
      const { deferredUntilDateKey: _d, ...rest } = t;
      return rest as Task;
    }
    return t;
  });
}
