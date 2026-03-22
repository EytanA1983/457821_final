/**
 * יומן — FullCalendar: אירועי Google Calendar + משימות עם תאריך; בחירת טווח ריק יוצרת משימה (עם חזרה אופציונלית).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import heLocale from "@fullcalendar/core/locales/he";
import frLocale from "@fullcalendar/core/locales/fr";
import arLocale from "@fullcalendar/core/locales/ar";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { useTranslation } from "react-i18next";
import { baseLanguageCode, isRtlLang } from "../utils/localeDirection";
import { useVoice } from "../hooks/useVoice";
import { showInfo, showPromise } from "../utils/toast";
import { CalendarEvent } from "../schemas/calendar";
import type { GoogleDashboardCalendarAnchor } from "../schemas/googleCalendarAnchor";
import type { TaskRead } from "../schemas/task";
import { getAccessToken } from "../utils/tokenStorage";
import { ROUTES } from "../utils/routes";
import { useAuth } from "../hooks/useAuth";
import { Modal } from "../components/Modal";

function visionJournalUserId(user: unknown): number | null {
  if (!user || typeof user !== "object") return null;
  const id = (user as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const n = Number.parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function logAxios(err: unknown, label: string) {
  if (axios.isAxiosError(err)) {
    const fullUrl = err.config?.baseURL ? `${err.config.baseURL}${err.config.url || ""}` : err.config?.url;
    console.error(label, {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      fullURL: fullUrl,
      data: err.response?.data,
    });
    return;
  }
  console.error(label, err);
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s: string): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

type CalendarRecurrenceChoice = "daily" | "weekly" | "every_three_weeks" | "monthly";

function buildTaskCreateBody(
  title: string,
  due: Date,
  repeatEnabled: boolean,
  recurrence: CalendarRecurrenceChoice,
): Record<string, unknown> {
  const iso = due.toISOString();
  const base: Record<string, unknown> = { title: title.trim(), due_date: iso };
  if (!repeatEnabled) {
    base.recurrence = "none";
    return base;
  }
  if (recurrence === "daily") {
    base.recurrence = "daily";
    return base;
  }
  if (recurrence === "weekly") {
    base.recurrence = "weekly";
    return base;
  }
  if (recurrence === "monthly") {
    base.recurrence = "monthly";
    return base;
  }
  // every three weeks — RRULE + template instances
  base.recurrence = "weekly";
  base.rrule_string = "FREQ=WEEKLY;INTERVAL=3";
  base.rrule_start_date = iso;
  return base;
}

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const uid = visionJournalUserId(user);
  const { t, i18n } = useTranslation("calendar");
  const { t: tCommon } = useTranslation("common");
  const { t: tToast } = useTranslation("toast");
  const { speak } = useVoice();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDisconnected, setCalendarDisconnected] = useState(false);
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek">("dayGridMonth");
  const calendarRef = useRef<FullCalendar | null>(null);
  const pendingSelectRef = useRef<DateSelectArg | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDueLocal, setAddTaskDueLocal] = useState("");
  const [addTaskRepeat, setAddTaskRepeat] = useState(false);
  const [addTaskRecurrence, setAddTaskRecurrence] = useState<CalendarRecurrenceChoice>("weekly");

  const baseLang = baseLanguageCode(i18n.language);
  const calendarLocale =
    baseLang === "he" ? "he" : baseLang === "fr" ? "fr" : baseLang === "ar" ? "ar" : baseLang === "ru" ? "ru" : "en";
  const calendarDirection = isRtlLang(i18n.language) ? "rtl" : "ltr";

  const { data: calendarAnchor } = useQuery<GoogleDashboardCalendarAnchor>({
    queryKey: ["google-calendar", "dashboard-anchor", uid],
    queryFn: async () => {
      const { data } = await api.get<GoogleDashboardCalendarAnchor>("/google-calendar/dashboard-anchor");
      return data;
    },
    enabled: uid != null && !!getAccessToken(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const calendarTimeZone =
    calendarAnchor?.connected && calendarAnchor.time_zone ? calendarAnchor.time_zone : undefined;

  const handleViewChange = (nextView: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek") => {
    setView(nextView);
    const apiRef = calendarRef.current?.getApi();
    if (apiRef) {
      apiRef.changeView(nextView);
    }
  };

  const loadCalendarEvents = useCallback(async () => {
    try {
      const { data } = await api.get<CalendarEvent[]>("/google-calendar/events", {
        params: {
          limit: 250,
          past_days: 14,
          future_days: 120,
        },
      });
      setCalendarEvents(data || []);
      setCalendarDisconnected(false);
    } catch (error: unknown) {
      logAxios(error, "[CalendarPage] google calendar");
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403 || status === 404) {
        setCalendarDisconnected(true);
      }
      setCalendarEvents([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const { data } = await api.get<TaskRead[]>("/tasks", { params: { completed: false } });
      setTasks(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      logAxios(error, "[CalendarPage] tasks");
      setTasks([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCalendarEvents(), loadTasks()]);
  }, [loadCalendarEvents, loadTasks]);

  useEffect(() => {
    if (!getAccessToken()) {
      setCalendarEvents([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  const connectGoogleCalendar = async () => {
    try {
      const { data } = await api.get<{ auth_url?: string }>("/auth/google/login");
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.href = ROUTES.SETTINGS;
  };

  const closeAddModal = () => {
    const sel = pendingSelectRef.current;
    if (sel?.view?.calendar) {
      try {
        sel.view.calendar.unselect();
      } catch {
        /* ignore */
      }
    }
    pendingSelectRef.current = null;
    setAddModalOpen(false);
    setAddTaskTitle("");
    setAddTaskDueLocal("");
    setAddTaskRepeat(false);
    setAddTaskRecurrence("weekly");
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    pendingSelectRef.current = selectInfo;
    setAddTaskDueLocal(toDatetimeLocalValue(selectInfo.start));
    setAddTaskTitle("");
    setAddTaskRepeat(false);
    setAddTaskRecurrence("weekly");
    setAddModalOpen(true);
  };

  const submitAddTask = () => {
    const title = addTaskTitle.trim();
    if (!title) {
      showInfo(t("addTaskTitleLabel"));
      return;
    }
    const due = fromDatetimeLocalValue(addTaskDueLocal);
    if (!due) {
      showInfo(t("addTaskDueLabel"));
      return;
    }
    const body = buildTaskCreateBody(title, due, addTaskRepeat, addTaskRecurrence);
    const p = api.post<TaskRead>("/tasks", body);
    showPromise(p, {
      loading: tToast("creating_task"),
      success: tToast("task_created"),
      error: tToast("task_creation_failed"),
    });
    void p
      .then(async () => {
        await loadTasks();
        speak(t("speakTaskCreated"));
        closeAddModal();
      })
      .catch(() => {});
  };

  const scrollCalendarIntoView = () => {
    try {
      calendarRef.current?.getApi()?.scrollToTime("08:00:00");
    } catch {
      /* timeGrid only */
    }
    document.getElementById("calendar-main-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const googleEvents: EventInput[] = calendarEvents.map((event) => ({
    id: `event-${event.id}`,
    title: event.summary || t("untitledEvent"),
    start: event.start,
    end: event.end || event.start,
    backgroundColor: "#2563eb",
    borderColor: "#1d4ed8",
    extendedProps: {
      type: "calendar",
      eventId: event.id,
      description: event.description,
      location: event.location,
      htmlLink: event.htmlLink,
    },
  }));

  const taskEvents: EventInput[] = tasks
    .filter((task) => task.due_date && !task.completed)
    .map((task) => ({
      id: `task-${task.id}`,
      title: `✓ ${task.title}`,
      start: task.due_date as string,
      end: task.due_date
        ? new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString()
        : undefined,
      backgroundColor: "#92400e",
      borderColor: "#78350f",
      extendedProps: {
        type: "task",
        taskId: task.id,
      },
    }));

  const events: EventInput[] = [...googleEvents, ...taskEvents];

  const busyCount = calendarEvents.length;

  const handleEventClick = (clickInfo: EventClickArg) => {
    const ext = clickInfo.event.extendedProps as { type?: string; htmlLink?: string; taskId?: number };
    if (ext.type === "task") {
      showInfo(String(clickInfo.event.title || ""));
      return;
    }
    const htmlLink = ext.htmlLink;
    if (typeof htmlLink === "string" && htmlLink.length > 0) {
      window.open(htmlLink, "_blank", "noopener,noreferrer");
      speak(t("openEvent"));
      return;
    }
    showInfo(String(clickInfo.event.title || t("untitledEvent")));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={calendarDirection}>
        <div className="text-gray-600 dark:text-gray-300">{tCommon("loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-cream dark:bg-dark-bg min-h-screen" dir={calendarDirection}>
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-dark-text">{t("title")}</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">{t("googleOnlyIntro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={ROUTES.MY_VISION_BOARD} className="wow-btn inline-flex items-center justify-center no-underline">
              {t("linkVisionBoard")}
            </Link>
            <button type="button" className="wow-btn" onClick={() => void refreshAll()}>
              {tCommon("refresh")}
            </button>
          </div>
        </header>

        {calendarDisconnected ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4"
            role="status"
          >
            <p className="font-semibold text-amber-900 dark:text-amber-100">{t("noCalendarConnected")}</p>
            <p className="text-sm text-amber-900/90 dark:text-amber-100/90 mt-1">{t("connectBody")}</p>
            <button type="button" className="wow-btn wow-btnPrimary mt-3" onClick={() => void connectGoogleCalendar()}>
              {t("connectCta")}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
            <p className="text-sm text-emerald-900 dark:text-emerald-100">{t("googleHint", { count: busyCount })}</p>
            <button
              type="button"
              className="text-sm underline text-emerald-900 dark:text-emerald-100 mt-2"
              onClick={() => void connectGoogleCalendar()}
            >
              {t("reconnect")}
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-lg p-2 sm:p-4" id="calendar-main-grid">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleViewChange("dayGridMonth")}
              className={`px-4 py-2 rounded-lg ${
                view === "dayGridMonth" ? "bg-mint text-white" : "bg-gray-200 dark:bg-dark-surface text-gray-700 dark:text-dark-text"
              }`}
            >
              {t("month")}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("timeGridWeek")}
              className={`px-4 py-2 rounded-lg ${
                view === "timeGridWeek" ? "bg-mint text-white" : "bg-gray-200 dark:bg-dark-surface text-gray-700 dark:text-dark-text"
              }`}
            >
              {t("week")}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("timeGridDay")}
              className={`px-4 py-2 rounded-lg ${
                view === "timeGridDay" ? "bg-mint text-white" : "bg-gray-200 dark:bg-dark-surface text-gray-700 dark:text-dark-text"
              }`}
            >
              {t("day")}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("listWeek")}
              className={`px-4 py-2 rounded-lg ${
                view === "listWeek" ? "bg-mint text-white" : "bg-gray-200 dark:bg-dark-surface text-gray-700 dark:text-dark-text"
              }`}
            >
              {t("list")}
            </button>
          </div>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            locales={[heLocale, frLocale, arLocale, ruLocale]}
            initialView="dayGridMonth"
            timeZone={calendarTimeZone || "local"}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            locale={calendarLocale}
            direction={calendarDirection}
            editable={false}
            selectable
            selectMirror
            events={events}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="auto"
            eventDisplay="block"
            dayMaxEvents
            moreLinkClick="popover"
            datesSet={(arg) => {
              const nextView = arg.view.type as typeof view;
              if (nextView !== view) setView(nextView);
            }}
            businessHours={{
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
              startTime: "08:00",
              endTime: "20:00",
            }}
          />
        </div>
      </div>

      {addModalOpen ? (
        <Modal onClose={closeAddModal} title={t("addTaskModalTitle")} description={null}>
          <div className="space-y-4" dir={calendarDirection}>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("pickOnCalendarHint")}</p>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">{t("addTaskTitleLabel")}</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-dark-surface"
              value={addTaskTitle}
              onChange={(e) => setAddTaskTitle(e.target.value)}
              placeholder={t("addTaskTitlePlaceholder")}
              maxLength={120}
            />
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">{t("addTaskDueLabel")}</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-dark-surface"
                value={addTaskDueLocal}
                onChange={(e) => setAddTaskDueLocal(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("addTaskDueHint")}</p>
              <button type="button" className="mt-2 text-sm underline text-mint-700 dark:text-mint-300" onClick={scrollCalendarIntoView}>
                {t("focusCalendar")}
              </button>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={addTaskRepeat}
                  onChange={(e) => setAddTaskRepeat(e.target.checked)}
                />
                {t("addTaskRecurrenceToggle")}
              </label>
              {addTaskRepeat ? (
                <div className="grid gap-2 ps-1">
                  {(
                    [
                      ["daily", t("recurrenceDaily")],
                      ["weekly", t("recurrenceWeekly")],
                      ["every_three_weeks", t("recurrenceEveryThreeWeeks")],
                      ["monthly", t("recurrenceMonthly")],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="cal-recurrence"
                        checked={addTaskRecurrence === value}
                        onChange={() => setAddTaskRecurrence(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" className="wow-btn" onClick={closeAddModal}>
                {tCommon("cancel")}
              </button>
              <button type="button" className="wow-btn wow-btnPrimary" onClick={submitAddTask}>
                {t("saveTask")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

export default CalendarPage;
