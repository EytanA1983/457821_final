import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import api from "../api";
import { invalidateTasksAndProgressCaches } from "../api/dashboardBootstrap";
import { showSuccess, showError } from "../utils/toast";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "../utils/localeDirection";
import { isDateInputBeforeToday, todayLocalDateInputValue } from "../utils/localDateInput";

function decodeTitleQuery(raw: string | null): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export const AddTaskPage = () => {
  const { i18n } = useTranslation();
  const { t } = useTranslation("tasks");
  const { t: tToast } = useTranslation("toast");
  const dirAttr = isRtlLang(i18n.language) ? "rtl" : "ltr";

  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState(() =>
    decodeTitleQuery(searchParams.get("title") ?? searchParams.get("suggestion")),
  );
  const [dueDate, setDueDate] = useState("");
  const [isKidTask, setIsKidTask] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [assigneeAge, setAssigneeAge] = useState("");
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const next = decodeTitleQuery(searchParams.get("title") ?? searchParams.get("suggestion"));
    if (next) setTitle(next);
  }, [searchParams]);
  const roomIdParam = Number(searchParams.get("roomId"));
  const roomId = Number.isFinite(roomIdParam) && roomIdParam > 0 ? roomIdParam : null;

  const minDueDate = todayLocalDateInputValue();

  /** 1–3 characters: load distinct titles from DB (all categories/rooms). */
  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 3) {
      setTitleSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(false);
      return;
    }

    const prefix = trimmed.slice(0, 3);
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      setSuggestionsError(false);
      try {
        const { data } = await api.get<{ titles: string[] }>("/tasks/title-suggestions", {
          params: { prefix },
          signal: ac.signal,
        });
        setTitleSuggestions(Array.isArray(data?.titles) ? data.titles : []);
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && (e.code === "ERR_CANCELED" || axios.isCancel(e))) return;
        setTitleSuggestions([]);
        setSuggestionsError(true);
      } finally {
        if (!ac.signal.aborted) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [title]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dueDate && isDateInputBeforeToday(dueDate)) {
      showError(t("due_date_min_today_error"));
      return;
    }
    try {
      await api.post("/tasks", {
        title,
        due_date: dueDate ? dueDate : null,
        room_id: roomId,
        is_kid_task: isKidTask,
        assignee_name: assigneeName.trim() || null,
        assignee_age: assigneeAge ? Number(assigneeAge) : null,
      });
      await invalidateTasksAndProgressCaches(queryClient);
      if (import.meta.env.DEV) {
        console.debug("[task:create] POST /tasks ok, invalidated tasks+progress caches", { roomId });
      }
      showSuccess(tToast("task_created"));
      navigate(ROUTES.HOME);
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      showError(detail ?? tToast("task_creation_failed"));
    }
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 safe-top safe-bottom" dir={dirAttr}>
      <form onSubmit={submit} className="max-w-md mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg mt-4">
        <h2 className="text-xl sm:text-2xl mb-6 font-bold">{t("add_task")}</h2>

        <label className="block mb-4">
          <span className="block mb-2 text-sm font-medium">{t("task_title")}</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full py-3 sm:py-2 text-base"
            placeholder={t("add_task_title_placeholder") || undefined}
            autoComplete="off"
            aria-describedby={
              title.trim().length >= 1 && title.trim().length <= 3
                ? "add-task-title-suggestions"
                : undefined
            }
          />
        </label>

        {title.trim().length >= 1 && title.trim().length <= 3 ? (
          <div
            id="add-task-title-suggestions"
            className="mb-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-3"
            role="region"
            aria-label={t("title_suggestions_group_label")}
          >
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              {t("title_suggestions_group_label")}
            </div>
            {suggestionsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("title_suggestions_loading")}</p>
            ) : suggestionsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{t("title_suggestions_error")}</p>
            ) : titleSuggestions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("title_suggestions_empty")}</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto" role="listbox">
                {titleSuggestions.map((s) => (
                  <li key={s} role="none">
                    <button
                      type="button"
                      role="option"
                      className="w-full text-start rtl:text-right rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-transparent hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={() => {
                        setTitle(s);
                        setTitleSuggestions([]);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <label className="block mb-6">
          <span className="block mb-2 text-sm font-medium">{t("due_date_optional")}</span>
          <input
            type="date"
            min={minDueDate}
            value={dueDate}
            onChange={(e) => {
              const v = e.target.value;
              if (v && isDateInputBeforeToday(v)) return;
              setDueDate(v);
            }}
            className="input w-full py-3 sm:py-2 text-base"
          />
          <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">{t("due_date_min_today_hint")}</span>
        </label>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={isKidTask} onChange={(e) => setIsKidTask(e.target.checked)} />
          <span className="text-sm font-medium">{t("kid_task_label")}</span>
        </label>

        {isKidTask && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <label className="block">
              <span className="block mb-2 text-sm font-medium">{t("kid_name")}</span>
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="input w-full py-3 sm:py-2 text-base"
                placeholder={t("kid_name_placeholder")}
              />
            </label>
            <label className="block">
              <span className="block mb-2 text-sm font-medium">{t("kid_age")}</span>
              <input
                type="number"
                min={1}
                max={18}
                value={assigneeAge}
                onChange={(e) => setAssigneeAge(e.target.value)}
                className="input w-full py-3 sm:py-2 text-base"
                placeholder="6"
              />
            </label>
          </div>
        )}

        <button type="submit" className="btn btn-sky w-full touch-target py-4 sm:py-3 text-base font-medium">
          {t("save_task")}
        </button>
      </form>
    </div>
  );
};
