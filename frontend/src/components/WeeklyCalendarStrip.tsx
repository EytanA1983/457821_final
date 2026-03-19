import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./WeeklyCalendarStrip.module.css";
import type { Task } from "../app/types";
import { useTranslation } from "react-i18next";

const HEB_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeekIsrael(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sunday
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function minutesFromHHMM(hhmm?: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
// weekly שאין לו יום -> מפזרים דטרמיניסטית
function stableDayIndex(taskId: string) {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0;
  return hash % 7;
}

type PlacedTask = {
  renderId: string;
  originalId: number;
  title: string;
  completed: boolean;
  dayIndex: number;      // 0..6
  startMin: number;
  endMin: number;
  colIndex: number;
  colCount: number;
  displayColIndex: number;
  displayColCount: number;
  isHidden: boolean;
  overflowCount: number;
  topPct: number;        // 0..100
  heightPct: number;     // %
  timeLabel: string;     // "09:30"
};

const MAX_VISIBLE_OVERLAP_COLS = 3;

function assignColumnsForGroup(group: PlacedTask[]): PlacedTask[] {
  const sorted = [...group].sort((a, b) => (a.startMin - b.startMin) || (a.endMin - b.endMin));
  const active: Array<{ endMin: number; colIndex: number }> = [];
  let maxCols = 1;

  const placed = sorted.map((event) => {
    // Remove ended events from active columns.
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= event.startMin) {
        active.splice(i, 1);
      }
    }

    const usedCols = new Set(active.map((a) => a.colIndex));
    let colIndex = 0;
    while (usedCols.has(colIndex)) colIndex += 1;

    active.push({ endMin: event.endMin, colIndex });
    maxCols = Math.max(maxCols, active.length, colIndex + 1);

    return { ...event, colIndex };
  });

  const visibleColCount = Math.min(maxCols, MAX_VISIBLE_OVERLAP_COLS);
  let overflowBadgeAssigned = false;
  return placed.map((event) => {
    const isHidden = event.colIndex >= MAX_VISIBLE_OVERLAP_COLS;
    const displayColIndex = isHidden ? MAX_VISIBLE_OVERLAP_COLS - 1 : event.colIndex;
    const showOverflowBadge =
      !overflowBadgeAssigned &&
      !isHidden &&
      displayColIndex === MAX_VISIBLE_OVERLAP_COLS - 1 &&
      maxCols > MAX_VISIBLE_OVERLAP_COLS;
    if (showOverflowBadge) overflowBadgeAssigned = true;
    return {
      ...event,
      colCount: maxCols,
      displayColCount: visibleColCount,
      displayColIndex,
      isHidden,
      overflowCount: showOverflowBadge ? maxCols - MAX_VISIBLE_OVERLAP_COLS : 0,
    };
  });
}

function stackDayEvents(events: PlacedTask[]): PlacedTask[] {
  if (events.length <= 1) {
    return events.map((e) => ({
      ...e,
      colIndex: 0,
      colCount: 1,
      displayColIndex: 0,
      displayColCount: 1,
      isHidden: false,
      overflowCount: 0,
    }));
  }
  const sorted = [...events].sort((a, b) => (a.startMin - b.startMin) || (a.endMin - b.endMin));

  const result: PlacedTask[] = [];
  let group: PlacedTask[] = [];
  let groupMaxEnd = -1;

  for (const event of sorted) {
    if (!group.length) {
      group = [event];
      groupMaxEnd = event.endMin;
      continue;
    }

    // Strict overlap with the current connected overlap group.
    if (event.startMin < groupMaxEnd) {
      group.push(event);
      groupMaxEnd = Math.max(groupMaxEnd, event.endMin);
    } else {
      result.push(...assignColumnsForGroup(group));
      group = [event];
      groupMaxEnd = event.endMin;
    }
  }

  if (group.length) {
    result.push(...assignColumnsForGroup(group));
  }

  return result;
}

export default function WeeklyCalendarStrip({
  tasks,
  onToggleComplete,
  onTaskSelect,
  dayStartHour = 0,
  dayEndHour = 24,
  defaultDurationMin = 30,
}: {
  tasks: Task[];
  onToggleComplete?: (taskId: number) => void;
  onTaskSelect?: (taskId: number) => void;
  dayStartHour?: number;
  dayEndHour?: number;
  defaultDurationMin?: number;
}) {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const locale = isEnglish ? "en-US" : "he-IL";
  const dayLabels = isEnglish ? EN_DAYS : HEB_DAYS;
  const now = new Date();
  const weekStart = startOfWeekIsrael(now);
  const [viewMode, setViewMode] = useState<"weekly" | "daily">(() =>
    typeof window !== "undefined" && window.innerWidth <= 640 ? "daily" : "weekly"
  );
  const [activeDayIndex, setActiveDayIndex] = useState<number>(now.getDay());
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const timeGutterRef = useRef<HTMLDivElement | null>(null);
  const hourRowPx = 56;

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return {
          key: `d${i}`,
          label: dayLabels[i],
          date,
        };
      }),
    [dayLabels, weekStart]
  );

  const minutesWindow = (dayEndHour - dayStartHour) * 60;

  const placed: PlacedTask[] = useMemo(() => {
    const base = (tasks || [])
      .filter((t) => !!t.scheduledTime)
      .map((t) => {
        const mins = minutesFromHHMM(t.scheduledTime) ?? dayStartHour * 60;
        const startMin = clamp(mins, dayStartHour * 60, dayEndHour * 60);
        const endMin = clamp(startMin + defaultDurationMin, dayStartHour * 60, dayEndHour * 60);

        const dayIndex = t.frequency === "weekly" ? stableDayIndex(String(t.id)) : -1;

        const topPct = ((startMin - dayStartHour * 60) / minutesWindow) * 100;
        const heightPct = Math.max(((endMin - startMin) / minutesWindow) * 100, 3.2);

        return {
          renderId: String(t.id),
          originalId: Number(t.id),
          title: t.title,
          completed: !!t.completed,
          dayIndex,
          startMin,
          endMin,
          colIndex: 0,
          colCount: 1,
          displayColIndex: 0,
          displayColCount: 1,
          isHidden: false,
          overflowCount: 0,
          topPct,
          heightPct,
          timeLabel: t.scheduledTime || "",
        };
      })
      .flatMap((pt) => {
        const original = tasks.find((t) => Number(t.id) === pt.originalId);
        if (original?.frequency === "daily") {
          return Array.from({ length: 7 }, (_, i) => ({
            ...pt,
            dayIndex: i,
            renderId: `${pt.renderId}-d${i}`,
          }));
        }
        return [pt];
      })
      .map((pt) => ({
        ...pt,
        // non-daily weekly: ensure dayIndex is set
        dayIndex: pt.dayIndex === -1 ? 0 : pt.dayIndex,
      }));
    
    // Apply Google-like stacking per day so overlapping events split into side-by-side columns.
    const byDay = new Map<number, PlacedTask[]>();
    for (const event of base) {
      const dayEvents = byDay.get(event.dayIndex) ?? [];
      dayEvents.push(event);
      byDay.set(event.dayIndex, dayEvents);
    }

    const stacked: PlacedTask[] = [];
    for (const dayEvents of byDay.values()) {
      stacked.push(...stackDayEvents(dayEvents));
    }

    return stacked;
  }, [tasks, dayStartHour, dayEndHour, defaultDurationMin, minutesWindow]);

  const hourLabels = useMemo(() => {
    const arr: string[] = [];
    for (let h = dayStartHour; h <= dayEndHour; h++) arr.push(`${String(h).padStart(2, "0")}:00`);
    return arr;
  }, [dayStartHour, dayEndHour]);
  const totalHours = Math.max(dayEndHour - dayStartHour, 1);
  const gridHeightPx = hourRowPx * totalHours;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPct = ((clamp(nowMinutes, dayStartHour * 60, dayEndHour * 60) - dayStartHour * 60) / minutesWindow) * 100;
  const todayIndex = days.findIndex((d) => sameDay(d.date, now));
  const visibleDays = useMemo(() => {
    if (viewMode === "weekly") return days;
    return [days[activeDayIndex]];
  }, [activeDayIndex, days, viewMode]);

  useEffect(() => {
    const el = gridScrollRef.current;
    const gutterEl = timeGutterRef.current;
    if (!el) return;
    const minsFromStart = clamp(nowMinutes - dayStartHour * 60, 0, minutesWindow);
    const targetTop = (minsFromStart / 60) * hourRowPx - el.clientHeight * 0.35;
    el.scrollTop = Math.max(0, targetTop);
    if (gutterEl) {
      gutterEl.scrollTop = el.scrollTop;
    }
  }, [dayStartHour, hourRowPx, minutesWindow, nowMinutes, viewMode]);

  const handleGridScroll = () => {
    const el = gridScrollRef.current;
    const gutterEl = timeGutterRef.current;
    if (!el || !gutterEl) return;
    gutterEl.scrollTop = el.scrollTop;
  };

  return (
    <section
      className={styles.gcCard}
      dir={isEnglish ? "ltr" : "rtl"}
      aria-label={isEnglish ? "Google Calendar style weekly view" : "תצוגת שבוע בסגנון Google Calendar"}
    >
      <div className={styles.gcHeader}>
        <div className={styles.gcHeaderTop}>
          <div>
            <div className={styles.gcTitle}>{viewMode === "weekly" ? (isEnglish ? "Your week" : "השבוע שלך") : (isEnglish ? "Your day" : "היום שלך")}</div>
          </div>
          <div className={styles.gcControls}>
            <div className={styles.gcSegmented}>
              <button
                type="button"
                className={`${styles.gcSegmentBtn} ${viewMode === "daily" ? styles.gcSegmentBtnActive : ""}`}
                onClick={() => setViewMode("daily")}
              >
                {isEnglish ? "Daily" : "יומי"}
              </button>
              <button
                type="button"
                className={`${styles.gcSegmentBtn} ${viewMode === "weekly" ? styles.gcSegmentBtnActive : ""}`}
                onClick={() => setViewMode("weekly")}
              >
                {isEnglish ? "Weekly" : "שבועי"}
              </button>
            </div>
            {viewMode === "daily" && (
              <div className={styles.gcDayNav}>
                <button
                  type="button"
                  className={styles.gcDayNavBtn}
                  onClick={() => setActiveDayIndex((prev) => (prev + 6) % 7)}
                  aria-label={isEnglish ? "Previous day" : "יום קודם"}
                >
                  ◀
                </button>
                <span className={styles.gcDayNavLabel}>{dayLabels[activeDayIndex]}</span>
                <button
                  type="button"
                  className={styles.gcDayNavBtn}
                  onClick={() => setActiveDayIndex((prev) => (prev + 1) % 7)}
                  aria-label={isEnglish ? "Next day" : "יום הבא"}
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.gcWrap}>
        {/* Top-left corner spacer */}
        <div className={styles.gcCorner} />

        {/* Sticky day headers */}
        <div className={styles.gcDayHeaderRow}>
          {visibleDays.map((d) => {
            const idx = days.findIndex((x) => x.key === d.key);
            return (
            <div key={d.key} className={`${styles.gcDayHead} ${idx === todayIndex ? styles.gcDayHeadToday : ""}`}>
              <div className={styles.gcDayName}>{d.label}</div>
              <div className={styles.gcDayDate}>
                {d.date.toLocaleDateString(locale, { day: "numeric", month: "numeric" })}
              </div>
            </div>
          );})}
        </div>

        {/* Time gutter */}
        <div ref={timeGutterRef} className={styles.gcTimeGutter}>
          <div className={styles.gcTimeGutterInner} style={{ height: `${gridHeightPx}px` }}>
            {hourLabels.map((t) => (
              <div key={t} className={styles.gcTimeLabel}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable grid */}
        <div ref={gridScrollRef} className={styles.gcGridScroll} onScroll={handleGridScroll}>
          <div
            className={`${styles.gcGrid} ${viewMode === "daily" ? styles.gcGridDaily : ""}`}
            style={{ height: `${gridHeightPx}px` }}
          >
            {visibleDays.map((d) => {
              const dayIdx = days.findIndex((x) => x.key === d.key);
              const dayTasks = placed.filter((p) => p.dayIndex === dayIdx);
              const isToday = dayIdx === todayIndex;

              return (
                <div key={d.key} className={`${styles.gcDayCol} ${isToday ? styles.gcDayColToday : ""}`}>
                  {/* now line */}
                  {isToday && (
                    <div className={styles.gcNowLine} style={{ top: `${nowTopPct}%` }}>
                      <div className={styles.gcNowDot} />
                    </div>
                  )}

                  {/* events */}
                  {dayTasks.filter((t) => !t.isHidden).map((t) => {
                    const compact = t.heightPct < 6.5;

                    return (
                      <div
                        key={t.renderId}
                        className={`${styles.gcEvent} ${t.completed ? styles.gcEventDone : ""} ${compact ? styles.gcEventCompact : ""}`}
                        style={{
                          top: `${t.topPct}%`,
                          height: `${t.heightPct}%`,
                          left: `calc(${(t.displayColIndex / t.displayColCount) * 100}% + 6px)`,
                          right: `calc(${((t.displayColCount - t.displayColIndex - 1) / t.displayColCount) * 100}% + 6px)`,
                        }}
                        title={t.timeLabel}
                        onClick={() => onTaskSelect?.(t.originalId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onTaskSelect?.(t.originalId);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={styles.gcCheckBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete?.(t.originalId);
                          }}
                          aria-label={t.completed ? (isEnglish ? "Unmark completed" : "בטל סימון") : (isEnglish ? "Mark completed" : "סמן כבוצע")}
                          title={t.completed ? (isEnglish ? "Completed" : "בוצע") : (isEnglish ? "Mark completed" : "סמן כבוצע")}
                        >
                          {t.completed ? "✓" : ""}
                        </button>

                        <div className={styles.gcTimePill}>{t.timeLabel}</div>
                        <div className={styles.gcEventTitle}>{t.title}</div>
                        {t.overflowCount > 0 && (
                          <div className={styles.gcOverflowBadge}>+{t.overflowCount}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
