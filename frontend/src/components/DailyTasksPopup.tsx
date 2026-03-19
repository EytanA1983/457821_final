import { useEffect, useState } from "react";
import api from "../api";
import { TaskRead } from "../schemas/task";
import { showSuccess, showError } from "../utils/toast";
import { getAccessToken } from "../utils/tokenStorage";
import { useTranslation } from "react-i18next";

export const DailyTasksPopup = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        loadFail: "Could not load today's tasks.",
        loginToUpdate: "Please sign in to update tasks.",
        completed: "Task completed.",
        updateFail: "Could not update the task.",
        close: "Close",
        title: "Today's Tasks",
        subtitle: "Just 5 minutes. Pick one task and start.",
        markDone: "Mark as completed",
        empty: "No tasks right now — and that's okay. One small task already creates change.",
      }
    : {
        loadFail: "לא הצלחנו לטעון את משימות היום.",
        loginToUpdate: "יש להתחבר כדי לעדכן משימות.",
        completed: "המשימה הושלמה.",
        updateFail: "לא הצלחנו לעדכן את המשימה.",
        close: "סגור",
        title: "משימות היום",
        subtitle: "רק 5 דקות, בוחרות משימה אחת ומתחילות.",
        markDone: "סמן כהושלמה",
        empty: "אין משימות כרגע — וזה בסדר. משימה קטנה אחת כבר יוצרת שינוי.",
      };
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [open, setOpen] = useState(true);

  const load = async () => {
    const token = getAccessToken();
    if (!token) {
      // Avoid unauthenticated calls to protected endpoints.
      setTasks([]);
      return;
    }

    try {
      // Standard: /api/tasks?scope=today
      const { data } = await api.get<TaskRead[]>("/tasks", {
        params: { scope: 'today' },
      });
      setTasks(data);
    } catch (e: any) {
      showError(e.response?.data?.detail ?? text.loadFail);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (taskId: number) => {
    const token = getAccessToken();
    if (!token) {
      showError(text.loginToUpdate);
      return;
    }

    try {
      await api.patch(`/tasks/${taskId}`, { completed: true });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showSuccess(text.completed);
    } catch (e: any) {
      showError(e.response?.data?.detail ?? text.updateFail);
    }
  };

  if (!open || tasks.length === 0) return null;

  return (
    <div className="wowModalOverlay safe-top safe-bottom">
      <div 
        className="absolute inset-0" 
        onClick={() => setOpen(false)}
        aria-label={text.close}
      />
      <div className="wowModal" onClick={(event) => event.stopPropagation()}>
        <div className="wowModalInner">
          <div className="wowModalHeader">
            <div>
              <h2 className="wowModalTitle">{text.title}</h2>
              <p className="wow-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                {text.subtitle}
              </p>
            </div>
            <button 
              onClick={() => setOpen(false)} 
              className="wowModalClose"
              aria-label={text.close}
            >
              ✕
            </button>
          </div>

          <div className="wowModalBody">
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 touch-target py-1">
                  <input
                    type="checkbox"
                    id={`task-${t.id}`}
                    className="h-5 w-5 touch-target-sm"
                    onChange={() => complete(t.id)}
                    title={text.markDone}
                  />
                  <label 
                    htmlFor={`task-${t.id}`} 
                    className="cursor-pointer select-none flex-1 text-sm sm:text-base"
                  >
                    {t.title}
                  </label>
                </li>
              ))}
            </ul>
            {tasks.length === 0 && (
              <p className="wow-muted" style={{ marginTop: 10 }}>
                {text.empty}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
