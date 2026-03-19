import { Calendar, Clock } from "lucide-react";
import { Task } from "../app/types";
import { useTranslation } from "react-i18next";

interface CalendarWidgetProps {
  tasks: Task[];
}

export default function CalendarWidget({ tasks }: CalendarWidgetProps) {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const today = new Date();
  const locale = isEnglish ? "en-US" : "he-IL";
  const dayName = today.toLocaleDateString(locale, { weekday: "long" });
  const date = today.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const text = isEnglish
    ? {
        todayTasks: "Today's tasks",
        noScheduledTasks: "No scheduled tasks for today",
        completed: "Completed",
        total: "Total",
      }
    : {
        todayTasks: "יומן משימות להיום",
        noScheduledTasks: "אין משימות מתוזמנות להיום",
        completed: "הושלמו",
        total: "סה\"כ",
      };

  // מיון משימות לפי שעה
  const sortedTasks = [...tasks].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">{dayName}</h2>
          <p className="text-sm text-gray-600">{date}</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {text.todayTasks}
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {text.noScheduledTasks}
            </p>
          ) : (
            sortedTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  task.completed
                    ? "bg-white/50 opacity-60"
                    : "bg-white shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {task.scheduledTime}
                  </span>
                  <span
                    className={`text-sm ${
                      task.completed
                        ? "line-through text-gray-500"
                        : "text-gray-700"
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
                {task.completed && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {text.completed}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-indigo-600">
            {tasks.filter((t) => t.completed).length}
          </p>
          <p className="text-xs text-gray-600">{text.completed}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-orange-600">
            {tasks.filter((t) => !t.completed).length}
          </p>
          <p className="text-xs text-gray-600">{isEnglish ? "Pending" : "ממתינות"}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
          <p className="text-xs text-gray-600">{text.total}</p>
        </div>
      </div>
    </div>
  );
}
