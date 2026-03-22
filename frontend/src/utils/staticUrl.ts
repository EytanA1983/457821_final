/**
 * Backend serves uploads at `/static/...` (FastAPI StaticFiles).
 * Vite dev proxies `/static` to the API; production should proxy the same path.
 */
export function publicStaticUrl(path: string): string {
  const p = (path || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/") ? p : `/${p}`;
}
