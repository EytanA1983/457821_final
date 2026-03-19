import { useEffect, useState } from "react";
import api from "../api";
import { TaskRead } from "../schemas/task";
import { showSuccess, showError } from "../utils/toast";
import { getAccessToken } from "../utils/tokenStorage";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";

// Simple date formatting
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export const WeeklyTasksWidget = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        loadFail: "Could not load weekly tasks.",
        loginToUpdate: "Please sign in to update tasks.",
        completed: "Task completed.",
        updateFail: "Could not update the task.",
        title: "Weekly Tasks",
        authMissing: "Sign in to view your weekly tasks clearly.",
        loadError: "Couldn't load right now — we'll try again shortly.",
        login: "Go to login",
        backHome: "Back to home",
        empty: "No tasks right now — pick one small task and begin gently.",
        markDone: "Mark as completed",
      }
    : {
        loadFail: "לא הצלחנו לטעון את משימות השבוע.",
        loginToUpdate: "יש להתחבר כדי לעדכן משימות.",
        completed: "המשימה הושלמה.",
        updateFail: "לא הצלחנו לעדכן את המשימה.",
        title: "משימות השבוע",
        authMissing: "נתחבר כדי לראות את משימות השבוע בצורה רגועה וברורה.",
        loadError: "לא הצלחנו לטעון עכשיו, וזה בסדר — ננסה שוב בעוד רגע.",
        login: "להתחברות",
        backHome: "חזרה למסך הבית",
        empty: "אין משימות כרגע — בוחרות משימה אחת קטנה ומתחילות בנחת.",
        markDone: "סמן כהושלמה",
      };
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMissing, setAuthMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setTasks([]);
        setAuthMissing(true);
        setLoading(false);
        return;
      }
      setAuthMissing(false);
      setLoadError(false);
      try {
        // Standard: /api/tasks?scope=week
        const { data } = await api.get<TaskRead[]>("/tasks", {
          params: { scope: 'week' },
        });
        setTasks(data || []);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setAuthMissing(true);
        } else {
          setLoadError(true);
          showError(e.response?.data?.detail ?? text.loadFail);
        }
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const complete = async (taskId: number) => {
    if (!getAccessToken()) {
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

  if (loading) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 10 }}>{text.title}</div>
        <div className="wow-skeleton" style={{ height: 14, width: "70%", marginBottom: 10 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "92%", marginBottom: 8 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "86%", marginBottom: 8 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "78%" }} />
      </div>
    );
  }

  if (authMissing || loadError) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 8 }}>{text.title}</div>
        <div className="wow-muted" style={{ marginBottom: 14 }}>
          {authMissing
            ? text.authMissing
            : text.loadError}
        </div>
        <button
          type="button"
          className="wow-btn wow-btnPrimary"
          onClick={() => {
            window.location.href = authMissing ? ROUTES.LOGIN : ROUTES.HOME;
          }}
        >
          {authMissing ? text.login : text.backHome}
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 8 }}>{text.title}</div>
        <p className="wow-muted" style={{ margin: 0 }}>
          {text.empty}
        </p>
      </div>
    );
  }

  return (
    <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="wow-title" style={{ fontSize: 18, marginBottom: 10 }}>{text.title}</div>
      <ul className="space-y-2 max-h-64 overflow-y-auto" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 touch-target py-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <input
              type="checkbox"
              id={`weekly-task-${t.id}`}
              className="h-4 w-4 touch-target-sm"
              onChange={() => complete(t.id)}
              title={text.markDone}
            />
            <label 
              htmlFor={`weekly-task-${t.id}`} 
              className="cursor-pointer select-none flex-1 text-sm"
            >
              <span className="font-medium">{t.title}</span>
              {t.due_date && (
                <span className="wow-muted text-xs mr-2">
                  ({formatDate(t.due_date)})
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};
