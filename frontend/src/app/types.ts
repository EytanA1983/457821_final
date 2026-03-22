/**
 * Local types for app-specific data structures
 * 
 * Note: These are simplified types for UI components.
 * For API types, use:
 * - TaskRead from '../schemas/task'
 * - RoomRead from '../schemas/room'
 */

export interface Task {
  id: string;
  title: string;
  room: string;
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
  scheduledTime: string;
  /**
   * Local calendar date (YYYY-MM-DD) when a deferred task should appear next in the week strip.
   * One-shot: cleared when the week rolls past that date or when the task is completed.
   */
  deferredUntilDateKey?: string;
  /**
   * When `frequency === "monthly"`: calendar day-of-month (1–31) for the dashboard strip.
   * Set from API `due_date` when recurrence is monthly (e.g. 1st of month).
   */
  monthlyDayOfMonth?: number;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
}
