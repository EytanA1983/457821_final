/**
 * Daily Focus schemas
 * Matches backend app/schemas/daily_focus.py
 */
export interface DailyFocusTaskMini {
  id: number;
  title: string;
  room_id: number | null;
  due_date: string | null; // ISO datetime string
  completed: boolean;
}

export interface DailyFocusRead {
  id: number | null;
  user_id: number;
  date: string; // ISO date string (YYYY-MM-DD)
  task_id: number | null;
  completed_at: string | null; // ISO datetime string
  task: DailyFocusTaskMini | null;
}

export interface DailyFocusCompleteIn {
  task_id?: number | null;
}

export interface DailyFocusRefreshIn {
  preferred_room_id?: number | null;
}
