/** Matches backend app/schemas/progress.py (GET /api/progress/summary). */

export interface DailyCompletedCount {
  date: string;
  count: number;
}

export interface ProgressSummaryRead {
  completed_tasks_this_week: number;
  rooms_progressed_this_week: number;
  streak_days: number;
  daily_completed_counts: DailyCompletedCount[];
  range?: "week" | "month";
}
