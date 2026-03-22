/**
 * Map API TaskRead → local Dashboard Task model (week strip + checkmarks).
 */
import type { Task } from "../app/types";
import type { TaskRead } from "../schemas/task";
import { formatLocalDateKey } from "./dashboardWeekFormat";

function guessRoomSlug(t: TaskRead): Task["room"] {
  const name = t.room?.name?.toLowerCase() ?? "";
  if (name.includes("kitchen") || name.includes("מטבח")) return "kitchen";
  if (name.includes("bedroom") || name.includes("שינה")) return "bedroom";
  if (name.includes("living") || name.includes("סלון")) return "living-room";
  if (name.includes("closet") || name.includes("ארון")) return "closet";
  if (name.includes("bath") || name.includes("אמבט") || name.includes("שירותים")) return "bathroom";
  if (name.includes("office") || name.includes("משרד")) return "office";
  if (name.includes("kids") || name.includes("ילד")) return "kids";
  return "kitchen";
}

function scheduledTimeFromDueDate(due?: string | null): string {
  if (!due) return "09:00";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "09:00";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Server tasks drive the dashboard list after login when the API returns any rows.
 * - `recurrence: none` + `due_date` → appears only on that local calendar day (same idea as deferral slot).
 * - `daily` / `weekly` / `monthly` → same rules as demo tasks.
 */
export function mapTaskReadToDashboardTask(t: TaskRead): Task {
  const recurrence = (t.recurrence ?? "none").toString().toLowerCase();
  const scheduledTime = scheduledTimeFromDueDate(t.due_date);
  const room = guessRoomSlug(t);

  let frequency: Task["frequency"] = "daily";
  let deferredUntilDateKey: string | undefined;
  let monthlyDayOfMonth: number | undefined;

  if (recurrence === "daily") {
    frequency = "daily";
  } else if (recurrence === "weekly") {
    frequency = "weekly";
  } else if (recurrence === "monthly") {
    frequency = "monthly";
    if (t.due_date) {
      const md = new Date(t.due_date);
      if (!Number.isNaN(md.getTime())) {
        const dom = md.getDate();
        if (dom >= 1 && dom <= 31) monthlyDayOfMonth = dom;
      }
    }
  } else if (t.due_date) {
    const d = new Date(t.due_date);
    if (!Number.isNaN(d.getTime())) {
      deferredUntilDateKey = formatLocalDateKey(d);
    }
    frequency = "daily";
  } else {
    frequency = "daily";
  }

  const base: Task = {
    id: String(t.id),
    title: t.title,
    room,
    completed: !!t.completed,
    frequency,
    scheduledTime,
    ...(deferredUntilDateKey ? { deferredUntilDateKey } : {}),
    ...(monthlyDayOfMonth != null ? { monthlyDayOfMonth } : {}),
  };

  /**
   * Snooze synced from server: recurring tasks with `due_date` on a future local calendar day
   * should appear only on that day in the week strip (matches "defer to tomorrow" PUT).
   * When that day arrives, `dueKey > todayKey` is false and normal daily/weekly/monthly rules apply.
   */
  if (t.due_date && (recurrence === "daily" || recurrence === "weekly" || recurrence === "monthly")) {
    const dueKey = formatLocalDateKey(new Date(t.due_date));
    const todayKey = formatLocalDateKey(new Date());
    if (dueKey > todayKey) {
      base.deferredUntilDateKey = dueKey;
    }
  }

  return base;
}
