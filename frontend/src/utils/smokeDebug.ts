/**
 * Temporary structured logs for auth / smoke testing.
 * Remove or disable when the app is stable in production.
 */
export function smokeDebug(step: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[SMOKE-DEBUG]", step, { ...data, t: new Date().toISOString() });
}
