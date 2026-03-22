/**
 * Dashboard week strip + selected-day subtitle — locale-aware dates via `Intl`
 * only. BCP-47 tags come from `resolveIntlLocaleTag` (single source in
 * `intlUiLocale.ts`); keep components free of per-language branches.
 */
import { resolveIntlLocaleTag } from "./intlUiLocale";

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Parse YYYY-MM-DD as local calendar midnight (browser local timezone). */
export function parseDateKeyLocal(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Add calendar days to a YYYY-MM-DD key (local date arithmetic). */
export function addDaysToDateKey(ymd: string, delta: number): string {
  const d = parseDateKeyLocal(ymd);
  if (!d) return ymd;
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return formatLocalDateKey(x);
}

/**
 * Local calendar day (YYYY-MM-DD) + wall time HH:mm in the user's local TZ → ISO UTC for API `due_date`.
 */
export function dateKeyAndLocalTimeToIsoUtc(dateKey: string, timeHHmm: string): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeHHmm.trim());
  if (!dm || !tm) return new Date().toISOString();
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const d = Number(dm[3]);
  const hh = Number(tm[1]);
  const min = Number(tm[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(hh) || !Number.isFinite(min)) {
    return new Date().toISOString();
  }
  const local = new Date(y, mo, d, hh, min, 0, 0);
  return local.toISOString();
}

/** Seven YYYY-MM-DD keys Sun→Sat for the browser-local week containing `reference`. */
export function buildLocalSundayWeekDateKeys(reference: Date = new Date()): string[] {
  const n = new Date(reference);
  n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() - n.getDay());
  return Array.from({ length: 7 }, (_, i) => formatLocalDateKey(addDaysLocal(n, i)));
}

/** Local calendar key for comparisons (deferrals, week boundaries). */
export function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Long weekday + long month + day number (subtitle under “tasks for selected day”). */
export function formatDashboardLongDate(date: Date, lang: string | undefined): string {
  const loc = resolveIntlLocaleTag(lang);
  return date.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Long weekday + month + day for a civil date (YYYY-MM-DD), optionally in an IANA timezone
 * (e.g. Google Calendar primary).
 */
export function formatDashboardLongDateFromYmd(
  ymd: string,
  lang: string | undefined,
  timeZone: string | undefined,
): string {
  const loc = resolveIntlLocaleTag(lang);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const instant = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  return instant.toLocaleDateString(loc, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Month + year for the week strip chrome (anchored to week start). */
export function formatDashboardWeekMonthYear(weekStart: Date, lang: string | undefined): string {
  const loc = resolveIntlLocaleTag(lang);
  return weekStart.toLocaleDateString(loc, { month: "long", year: "numeric" });
}

export function formatDashboardWeekMonthYearFromYmd(
  weekStartYmd: string,
  lang: string | undefined,
  timeZone: string | undefined,
): string {
  const loc = resolveIntlLocaleTag(lang);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartYmd.trim());
  if (!m) return weekStartYmd;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const instant = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  return instant.toLocaleDateString(loc, {
    month: "long",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Short range across the visible week (Sun–Sat), locale-aware when `formatRange` exists. */
export function formatDashboardWeekRange(weekStart: Date, lang: string | undefined): string {
  const loc = resolveIntlLocaleTag(lang);
  const end = addDaysLocal(weekStart, 6);
  const fmt = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric" });
  try {
    const anyFmt = fmt as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
    if (typeof anyFmt.formatRange === "function") {
      return anyFmt.formatRange(weekStart, end);
    }
  } catch {
    /* ignore */
  }
  return `${fmt.format(weekStart)} – ${fmt.format(end)}`;
}

export function formatDashboardWeekRangeFromYmds(
  weekStartYmd: string,
  weekEndYmd: string,
  lang: string | undefined,
  timeZone: string | undefined,
): string {
  const loc = resolveIntlLocaleTag(lang);
  const parse = (ymd: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return new Date(NaN);
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo, d, 12, 0, 0));
  };
  const start = parse(weekStartYmd);
  const end = parse(weekEndYmd);
  const tzOpts = timeZone ? { timeZone } : {};
  const fmt = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric", ...tzOpts });
  try {
    const anyFmt = fmt as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
    if (typeof anyFmt.formatRange === "function" && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return anyFmt.formatRange(start, end);
    }
  } catch {
    /* ignore */
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Short weekday label for a calendar day cell. */
export function formatDashboardWeekdayShort(date: Date, lang: string | undefined): string {
  const loc = resolveIntlLocaleTag(lang);
  return date.toLocaleDateString(loc, { weekday: "short" });
}

export function formatDashboardWeekdayShortFromYmd(
  ymd: string,
  lang: string | undefined,
  timeZone: string | undefined,
): string {
  const loc = resolveIntlLocaleTag(lang);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const instant = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  return instant.toLocaleDateString(loc, { weekday: "short", ...(timeZone ? { timeZone } : {}) });
}
