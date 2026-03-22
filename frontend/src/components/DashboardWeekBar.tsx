import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "../utils/localeDirection";
import {
  addDaysLocal,
  formatDashboardWeekMonthYear,
  formatDashboardWeekMonthYearFromYmd,
  formatDashboardWeekRange,
  formatDashboardWeekRangeFromYmds,
  formatDashboardWeekdayShort,
  formatDashboardWeekdayShortFromYmd,
} from "../utils/dashboardWeekFormat";
import type { Task } from "../app/types";
import { countPendingTasksForDateKey, countPendingTasksForWeekday } from "../utils/dashboardScheduledTasks";

export type DashboardWeekBarProps = {
  /** Start of the visible week (Sunday 00:00 local), aligned with `selectedDayIndex` (0=Sun). */
  weekStart: Date;
  /** When set (e.g. Google primary calendar week), strip labels + counts use these YYYY-MM-DD keys (Sun→Sat). */
  weekDateKeys?: readonly string[];
  /** IANA tz for labels when `weekDateKeys` is set (matches Google Calendar primary). */
  displayTimeZone?: string;
  /** Calendar “today” key for highlighting (Google `today` or local YYYY-MM-DD). */
  calendarTodayKey?: string;
  selectedDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  tasks: Task[];
  /** 0 = Sunday … 6 = Saturday — used when `weekDateKeys` is not provided. */
  todayDayIndex?: number;
};

export default function DashboardWeekBar({
  weekStart,
  weekDateKeys,
  displayTimeZone,
  calendarTodayKey,
  selectedDayIndex,
  onSelectDay,
  tasks,
  todayDayIndex = new Date().getDay(),
}: DashboardWeekBarProps) {
  const { i18n, t: td } = useTranslation("dashboard");
  const rtl = isRtlLang(i18n.language);

  const monthYearLabel = useMemo(() => {
    if (weekDateKeys?.length === 7 && weekDateKeys[0]) {
      return formatDashboardWeekMonthYearFromYmd(weekDateKeys[0], i18n.language, displayTimeZone);
    }
    return formatDashboardWeekMonthYear(weekStart, i18n.language);
  }, [weekDateKeys, weekStart, i18n.language, displayTimeZone]);

  const weekRangeLabel = useMemo(() => {
    if (weekDateKeys?.length === 7 && weekDateKeys[0] && weekDateKeys[6]) {
      return formatDashboardWeekRangeFromYmds(weekDateKeys[0], weekDateKeys[6], i18n.language, displayTimeZone);
    }
    return formatDashboardWeekRange(weekStart, i18n.language);
  }, [weekDateKeys, weekStart, i18n.language, displayTimeZone]);

  const days = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const ymd = weekDateKeys?.[i];
      const d = addDaysLocal(weekStart, i);
      const dow = ymd
        ? formatDashboardWeekdayShortFromYmd(ymd, i18n.language, displayTimeZone)
        : formatDashboardWeekdayShort(d, i18n.language);
      const dateNum = ymd ? Number(ymd.slice(8, 10)) : d.getDate();
      const count = ymd
        ? countPendingTasksForDateKey(tasks, ymd)
        : countPendingTasksForWeekday(tasks, i, weekStart);
      const isToday = ymd && calendarTodayKey ? ymd === calendarTodayKey : i === todayDayIndex;
      const isSelected = i === selectedDayIndex;
      return { i, dow, dateNum, count, isToday, isSelected };
    });
  }, [weekStart, weekDateKeys, displayTimeZone, calendarTodayKey, i18n.language, tasks, todayDayIndex, selectedDayIndex]);

  return (
    <section
      className="dashboard-week-strip"
      aria-label={td("weekStripAria")}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div className="dashboard-week-strip__chrome">
        <div className="dashboard-week-strip__header">
          <span className="dashboard-week-strip__month">{monthYearLabel}</span>
          <span className="dashboard-week-strip__range">{weekRangeLabel}</span>
        </div>
        <div
          className="dashboard-week-strip__row"
          role="tablist"
          dir={rtl ? "rtl" : "ltr"}
        >
          {days.map(({ i, dow, dateNum, count, isToday, isSelected }) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={td("weekStripDayAria", {
                day: dow,
                date: String(dateNum),
                count,
              })}
              className={`dashboard-week-strip__cell${isSelected ? " dashboard-week-strip__cell--selected" : ""}${isToday ? " dashboard-week-strip__cell--today" : ""}`}
              onClick={() => onSelectDay(i)}
            >
              <span className="dashboard-week-strip__dow">{dow}</span>
              <span className="dashboard-week-strip__date-wrap">
                <span className="dashboard-week-strip__date">{dateNum}</span>
              </span>
              {count > 0 ? (
                <span className="dashboard-week-strip__badge" aria-hidden="true">
                  {count > 9 ? "9+" : count}
                </span>
              ) : (
                <span className="dashboard-week-strip__badge dashboard-week-strip__badge--empty" aria-hidden="true">
                  ·
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
