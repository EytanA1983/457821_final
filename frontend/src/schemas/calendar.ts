/**
 * Google Calendar event schemas
 * תואם ל-backend/app/schemas/google_calendar.py
 */

export interface CalendarEvent {
  id: string;
  summary?: string;
  /** Task-derived “events” in widgets may use `title` instead of Google `summary`. */
  title?: string;
  start: string; // ISO string
  end: string; // ISO string
  description?: string | null;
  location?: string | null;
  htmlLink?: string | null;
}
