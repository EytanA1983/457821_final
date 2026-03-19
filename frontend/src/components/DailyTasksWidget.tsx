import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { TaskRead } from '../schemas/task';
import { showError } from '../utils/toast';
import { ROUTES } from '../utils/routes';
import { TaskSkeleton } from './SkeletonLoader';

type ViewMode = "today" | "week";

interface DailyTasksWidgetProps {
  maxItems?: number;
  showViewAll?: boolean;
  showToggle?: boolean; // Show today/week toggle
  viewMode?: ViewMode; // Optional: controlled viewMode from parent
  onViewModeChange?: (mode: ViewMode) => void; // Optional: callback for viewMode changes
}

export const DailyTasksWidget = ({ 
  maxItems = 5, 
  showViewAll = true,
  showToggle = false,
  viewMode: controlledViewMode,
  onViewModeChange
}: DailyTasksWidgetProps) => {
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("today");
  const viewMode = controlledViewMode ?? internalViewMode;
  
  const setViewMode = (mode: ViewMode) => {
    if (controlledViewMode === undefined) {
      setInternalViewMode(mode);
    }
    onViewModeChange?.(mode);
  };
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  // Load tasks using standard scope parameter
  useEffect(() => {
    setLoading(true);
    api
      .get<TaskRead[]>('/tasks', {
        params: { scope: viewMode },
      })
      .then((res) => {
        setTasks(res.data);
      })
      .catch((err) => {
        console.error(`Failed to load ${viewMode} tasks:`, err);
        showError(`שגיאה בטעינת משימות ${viewMode === 'today' ? 'היום' : 'השבוע'}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [viewMode]); // viewMode is now either controlled or internal

  // Toggle task completion
  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    setUpdating((prev) => new Set(prev).add(taskId));

    // Optimistic update
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !currentCompleted } : task
      )
    );

    try {
      await api.patch(`/tasks/${taskId}`, {
        completed: !currentCompleted,
      });

      // Remove completed task from list
      if (!currentCompleted) {
        setTasks((prev) => prev.filter((task) => task.id !== taskId));
      }
    } catch (err: any) {
      // Rollback
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: currentCompleted } : task
        )
      );
      console.error('Failed to update task:', err);
      showError(err.response?.data?.detail || 'שגיאה בעדכון משימה');
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const displayedTasks = tasks.slice(0, maxItems);
  const hasMore = tasks.length > maxItems;

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md border border-gray-200 dark:border-dark-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="emoji">📅</span>
          {viewMode === "today" ? "משימות היום" : "משימות השבוע"}
        </h2>
        <div className="flex items-center gap-2">
          {/* Toggle: היום / השבוע */}
          {showToggle && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("today")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all touch-target ${
                  viewMode === "today"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                היום
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all touch-target ${
                  viewMode === "week"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                השבוע
              </button>
            </div>
          )}
          {showViewAll && (
            <Link
              to={ROUTES.CALENDAR}
              className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
            >
              הצג הכל →
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <TaskSkeleton count={maxItems} />
      ) : displayedTasks.length === 0 ? (
        <div className="text-center p-4 sm:p-6 text-gray-500">
          <span className="emoji text-3xl block mb-2">🎉</span>
          <p className="text-sm">אין משימות {viewMode === "today" ? "היום" : "השבוע"}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {displayedTasks.map((task) => (
              <li
                key={task.id}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  task.completed
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-300 hover:border-sky-300'
                } ${updating.has(task.id) ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id, task.completed)}
                  disabled={updating.has(task.id)}
                  className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      task.completed ? 'line-through text-gray-500' : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.room && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="emoji">🚪</span> {task.room.name}
                    </p>
                  )}
                </div>
                {updating.has(task.id) && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-sky"></div>
                )}
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-3 text-center">
              <Link
                to={ROUTES.CALENDAR}
                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                +{tasks.length - maxItems} משימות נוספות
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};
