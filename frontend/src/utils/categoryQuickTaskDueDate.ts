/**
 * Build a `due_date` for "monthly on the 1st" quick tasks: next 1st of month at local wall time,
 * never before today (matches backend `assert_due_date_not_in_past`).
 */
export function nextFirstOfMonthDueIsoLocal(hour = 9, minute = 0): string {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  const d = now.getDate();
  if (d > 1) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  const dt = new Date(y, m, 1, hour, minute, 0, 0);
  return dt.toISOString();
}
