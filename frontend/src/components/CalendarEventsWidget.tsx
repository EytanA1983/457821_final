import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { ROUTES } from '../utils/routes';
import { CalendarEvent } from '../schemas/calendar';

interface CalendarEventsWidgetProps {
  daysAhead?: number;
  maxItems?: number;
}

export const CalendarEventsWidget = ({ daysAhead = 7, maxItems = 5 }: CalendarEventsWidgetProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Get tasks with due_date in the next N days
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysAhead);

    api
      .get('/tasks', {
        params: {
          completed: false,
        },
      })
      .then((res) => {
        const tasks = res.data || [];
        
        // Filter tasks with due_date in the next N days
        const upcomingTasks = tasks
          .filter((task: any) => {
            if (!task.due_date) return false;
            const dueDate = new Date(task.due_date);
            return dueDate >= today && dueDate <= endDate;
          })
          .sort((a: any, b: any) => {
            const dateA = new Date(a.due_date).getTime();
            const dateB = new Date(b.due_date).getTime();
            return dateA - dateB;
          })
          .slice(0, maxItems)
          .map((task: any) => ({
            id: task.id.toString(),
            title: task.title,
            start: task.due_date,
            description: task.description,
            room: task.room?.name,
          }));

        setEvents(upcomingTasks);
      })
      .catch((err) => {
        console.error('Failed to load calendar events:', err);
        setEvents([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [daysAhead, maxItems]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'היום';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'מחר';
    } else {
      return date.toLocaleDateString('he-IL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md border border-gray-200 dark:border-dark-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="emoji">📆</span>
          אירועים קרובים
        </h2>
        <Link
          to={ROUTES.CALENDAR}
          className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
        >
          לוח שנה →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky"></div>
          <span className="mr-2 text-sm text-gray-600">טוען...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center p-6 text-gray-500">
          <span className="emoji text-3xl block mb-2">📅</span>
          <p className="text-sm">אין אירועים קרובים</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 p-2 rounded-lg border border-gray-200 dark:border-dark-border hover:border-sky-300 transition-colors"
            >
              <div className="flex-shrink-0 w-16 text-center">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {formatDate(event.start)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(event.start)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-dark-text">
                  {event.title ?? event.summary ?? "—"}
                </p>
                {event.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                    {event.description}
                  </p>
                )}
                {(event as any).room && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="emoji">🚪</span> {(event as any).room}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
