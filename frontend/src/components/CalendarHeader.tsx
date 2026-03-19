import { useEffect, useState } from "react";
import api from "../api";
import { CalendarEvent } from "../schemas/calendar";
import { TaskRead } from "../schemas/task";
import { showSuccess, showError } from "../utils/toast";
import { getAccessToken } from "../utils/tokenStorage";
import { CalendarEventSkeleton } from "./SkeletonLoader";

type ViewMode = "today" | "week";

interface CalendarHeaderProps {
  onViewChange?: (mode: ViewMode) => void;
}

/**
 * CalendarHeader - סרגל עליון מלבני עם תצוגת יומן קומפקטית
 * 
 * Layout:
 * - בצד שמאל: משימות יומיות/שבועיות
 * - בצד ימין: אירועי Google Calendar
 * - בחירה בין יומי/שבועי
 */
export const CalendarHeader = ({ onViewChange }: CalendarHeaderProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const loadData = async () => {
    const token = getAccessToken();
    if (!token) {
      // Don't call protected endpoints if user is not authenticated.
      setEvents([]);
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load Google Calendar events
      const range = viewMode === "today" ? "today" : "week";
      const eventsResponse = await api.get<CalendarEvent[]>(
        `/google-calendar/events?range=${range}&limit=10`
      );
      setEvents(eventsResponse.data || []);

      // Load tasks using standard scope parameter: /api/tasks?scope=today|week
      const tasksResponse = await api.get<TaskRead[]>(`/tasks`, {
        params: { scope: viewMode },
      });
      setTasks(tasksResponse.data || []);
    } catch (error) {
      console.error("[CalendarHeader] Error loading data:", error);
      setEvents([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    onViewChange?.(mode);
  };

  // Create task from calendar event
  const handleCreateTaskFromEvent = async (event: CalendarEvent) => {
    const token = getAccessToken();
    if (!token) {
      showError("יש להתחבר כדי ליצור משימה מהיומן.");
      return;
    }

    try {
      const taskData = {
        title: event.summary || 'משימה חדשה',
        description: event.description || '',
        due_date: event.start, // Use event start time as due_date
      };

      await api.post('/tasks', taskData);
      showSuccess('המשימה נוצרה מהאירוע.');
      
      // Reload tasks to show the new one
      loadData();
    } catch (error: any) {
      console.error('[CalendarHeader] Failed to create task from event:', error);
      showError(error.response?.data?.detail || 'לא הצלחנו ליצור משימה מהאירוע.');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const formatTaskDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <div className="bg-gradient-to-r from-sky-600 to-sky-700 dark:from-sky-800 dark:to-sky-900 text-white py-4 px-4 sm:px-6 shadow-lg safe-top">
      <div className="max-w-7xl mx-auto">
        {/* בחירת תצוגה - יומי/שבועי */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 bg-white/20 dark:bg-white/10 rounded-lg p-1">
            <button
              onClick={() => handleViewChange("today")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all touch-target ${
                viewMode === "today"
                  ? "bg-white text-sky-700 dark:bg-white dark:text-sky-900 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              📅 יומי
            </button>
            <button
              onClick={() => handleViewChange("week")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all touch-target ${
                viewMode === "week"
                  ? "bg-white text-sky-700 dark:bg-white dark:text-sky-900 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              📆 שבועי
            </button>
          </div>
        </div>

        {/* תוכן ראשי - משימות בצד שמאל, אירועים בצד ימין */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* צד שמאל: משימות */}
          <div className="bg-white/10 dark:bg-white/5 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="emoji">✓</span>
              <span>משימות {viewMode === "today" ? "היום" : "השבוע"}</span>
            </h3>
            {loading ? (
              <CalendarEventSkeleton count={3} />
            ) : tasks.length === 0 ? (
              <p className="text-white/70 text-sm">אין משימות</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 bg-amber-500/30 dark:bg-amber-600/30 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <span className="emoji text-xs">✓</span>
                    <span className="font-medium truncate flex-1">
                      {task.title}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-white/80 whitespace-nowrap">
                        {formatTaskDate(task.due_date)}
                      </span>
                    )}
                  </div>
                ))}
                {tasks.length > 5 && (
                  <p className="text-white/70 text-xs text-center">
                    +{tasks.length - 5} משימות נוספות
                  </p>
                )}
              </div>
            )}
          </div>

          {/* צד ימין: אירועי קלנדר */}
          <div className="bg-white/10 dark:bg-white/5 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="emoji">📅</span>
              <span>אירועי יומן {viewMode === "today" ? "היום" : "השבוע"}</span>
            </h3>
            {loading ? (
              <CalendarEventSkeleton count={3} />
            ) : events.length === 0 ? (
              <p className="text-white/70 text-sm">אין אירועים</p>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 bg-white/20 dark:bg-white/10 rounded-lg px-2 py-1.5 text-sm group hover:bg-white/30 transition-colors"
                  >
                    <span className="emoji text-xs">📅</span>
                    <span className="font-medium truncate flex-1">
                      {ev.summary ?? "אירוע ללא שם"}
                    </span>
                    <span className="text-xs text-white/80 whitespace-nowrap">
                      {formatDate(ev.start)}
                    </span>
                    {/* Create task from event button */}
                    <button
                      onClick={() => handleCreateTaskFromEvent(ev)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded touch-target"
                      title="צור משימה מאירוע זה"
                      aria-label="צור משימה מאירוע זה"
                    >
                      <span className="emoji text-xs">➕</span>
                    </button>
                  </div>
                ))}
                {events.length > 5 && (
                  <p className="text-white/70 text-xs text-center">
                    +{events.length - 5} אירועים נוספים
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
