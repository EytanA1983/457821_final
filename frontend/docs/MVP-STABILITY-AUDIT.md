# MVP stability & cleanup audit (2026-03-22)

Automated pass: `npm run typecheck` ✅ after targeted fixes.  
**Full `npm run lint`**: currently reports **many** warnings/errors across Cypress, `api.ts`, import-order, Tailwind class order, `no-console`, etc. — **not cleaned in this pass** (would be a large style refactor). Treat **lint green** as **follow-up**, not MVP gate, unless CI enforces it.

---

## A. E2E navigation (code-level; manual QA required)

| Step | Routes / mechanisms | Queries / mutations | Stale-state notes |
|------|------------------------|---------------------|-------------------|
| Register | `/register` | `POST /api/auth/register` | Tokens stored via `tokenStorage`; React Query cache empty until login |
| Login | `/login` | `POST /api/auth/login`, optional prefetch (`dashboardBootstrap`) | On success, invalidate/prefetch patterns in `App.tsx` — **verify manually** after token set |
| Dashboard | `/dashboard` | `useQuery` tasks, progress, dashboard keys | `invalidateTasksAndProgressCaches` used after mutations elsewhere; **risk** if new flows skip invalidation |
| → Categories | `/categories` | rooms/categories hooks | Shell tabs + `CategoriesNavTab` |
| → Category detail | `/categories/:categoryKey` | tasks for area | Back uses browser history |
| → Add task | `/tasks/new` or in-page | `POST /tasks` | Should call shared invalidation (see `dashboardBootstrap`) |
| Vision / Journal | `/vision`, `/calendar` | vision-journal API, Google events | LocalStorage quotes + server entries |
| Logout / Login | clears tokens | all queries should refetch or redirect | **Manual**: pie chart + selected day after re-login |
| Refresh | same URL | React Query `staleTime` / `refetchOnMount` | Dashboard uses explicit bootstrap — **manual** verify first paint |

**Blockers fixed in this pass (stability):** none for routing; **dashboardBootstrap** `import/first` violation fixed (could confuse tooling).

**Remaining risks (report only):**  
- Any screen that mutates tasks without `invalidateTasksAndProgressCaches` or matching `queryKey` can show stale pie/week strip until navigation/refetch.  
- Browser **back** after modal-heavy flows: verify FullCalendar `unselect` and Dashboard local state (selected day) — **manual**.

---

## B. Data persistence

| Data | Server | Client | Notes |
|------|--------|--------|--------|
| Auth | JWT / refresh | `tokenStorage` | Logout must clear both |
| Tasks CRUD | DB | React Query cache | Survives refresh if logged in |
| Dashboard defer / demo tasks | API + optional `dashboardLocalTasksStorage` | localStorage keyed by user | **Documented as intentional** for demo fallback |
| Vision journal entries | DB | — | Per `user_id` |
| Vision quotes | — | localStorage `wow-vision-journal-quotes-v1-u{id}` | **Not on server** (phase 2) |
| Selected calendar day (Dashboard) | — | component state | **Session-only** unless persisted elsewhere — confirm product intent |

**Manual checklist:** add task → logout → login → task still listed; complete task → progress updates; refresh on `/dashboard`.

---

## C. Dashboard correctness

Validated **by code review only** in this pass:

- `Dashboard.tsx` is large (~1.2k lines) — **hotspot** (see E).
- Rolling buckets + library refill live in `utils/dashboardRolling`, `dashboardTaskLibraryRefill`, `dashboardScheduledTasks` — **duplication risk** with category task queries.

**Manual:** first entry hydration, defer → tomorrow, pie matches `/tasks` + progress API.

---

## D. Cleanup performed

| Action | Detail |
|--------|--------|
| **Removed** | `frontend/src/components/CalendarHeader.tsx` — **no imports** anywhere under `src/` (dead after Calendar/Dashboard refactors). |
| **Fixed** | `frontend/src/api/dashboardBootstrap.ts` — imports at top of file (ESLint `import/first` errors). |
| **Fixed** | `frontend/src/components/AppLayout.tsx` — removed unnecessary type assertion; use `instanceof HTMLElement`. |
| **Fixed** | `frontend/src/api.ts` — verbose register logging: safer `Record<string, unknown>` for JSON body (drops bad `as any` assertions flagged by ESLint). |

**Not removed (report):**

- `GoogleCalendarHeader.tsx` — only self-reference in quick search; **confirm unused** then delete or wire to Home/Dashboard if product wants it.
- `smokeDebug` — dev-only; comment in file says remove when stable; **keep** until QA sign-off.
- `VisionScheduleMediaSection` — if file still exists on disk, **orphaned** after Vision journal move; grep in IDE recommended before delete.

---

## E. Spaghetti / tech debt (no broad refactor)

1. **`Dashboard.tsx`** — too many responsibilities (week strip, buckets, modals, progress, library). **Recommendation:** extract hooks `useDashboardTasks`, `useDashboardProgress`, `useDashboardSelectedDay`.
2. **`api.ts`** — interceptors + logging + token refresh; hard to test. **Recommendation:** split `apiClient.ts` / `authInterceptor.ts` (phase 2).
3. **Task vs category mapping** — scattered between Dashboard, `productCategories`, legacy `rooms`. **Recommendation:** single `resolveAreaPath` / category key helper (already partially in `routes.ts`).
4. **i18n** — some components still `isEnglish ? … : …` instead of namespaces. **Recommendation:** migrate strings gradually.
5. **Backend `create_task`** — recurrence + RRULE + cache invalidation; **keep** as-is for MVP.

---

## F. Imports

Touched files only; no repo-wide unused-import sweep (would need `eslint --fix` or `knip`).

---

## G. Dependencies (high-level)

### Frontend (`package.json`)

| Category | Examples | Note |
|----------|----------|------|
| **Keep** | `react`, `react-router-dom`, `@tanstack/react-query`, `@fullcalendar/*`, `axios`, `i18next` | Core product |
| **Maybe / verify** | `storybook*`, `cypress`, `openapi-generator`, `rollup-plugin-visualizer` | Dev/E2E — keep if team uses |
| **Do not remove without proof** | `@dnd-kit/*` | Used by drag-drop lists |

### Backend (`pyproject.toml`)

- **Keep:** FastAPI stack, SQLAlchemy, Celery, Google libs, redis, slowapi.  
- **Verify manually:** `strawberry-graphql` (GraphQL disabled in `main.py` comments) — **candidate for phase 2 removal** if truly unused.

---

## H. Routing

- **Legacy:** `/rooms`, `/rooms/:id` → redirects/gates in `LegacyRoomRedirects`.  
- **Protected:** children under `ProtectedRoute` in `routes.tsx`.  
- **Catch-all:** token check + redirect — uses `smokeDebug` in dev.

**Manual:** cold load `/dashboard` with valid token; no “wake up” via another tab.

---

## I. Build / typecheck

- `npm run typecheck` — **PASS** after this pass.  
- `npm run build` / `npm run build:no-critical` — **run in CI or locally** (not re-run here if image optimize slow).  
- `npm run lint` — **not clean** repo-wide; see top of doc.

---

## Final verdict

| Question | Answer |
|----------|--------|
| **MVP stable enough?** | **Conditionally yes**, pending **manual** auth/task/persistence and Dashboard day/progress checks. |
| **Manual QA still needed** | Full flow A1–A17; Google Calendar connect; vision journal upload; mobile Safari storage. |
| **Phase 2** | Lint/format baseline; remove unused headers/widgets; server-side inspiration quotes; `knip`/dead export scan; split `Dashboard.tsx` and `api.ts`; optional GraphQL dependency cleanup. |

---

## Files changed (this audit commit)

- `frontend/src/api/dashboardBootstrap.ts` — reorder imports / structure.  
- `frontend/src/components/AppLayout.tsx` — HTMLElement guard.  
- `frontend/src/api.ts` — register body typing for verbose debug.  
- `frontend/docs/MVP-STABILITY-AUDIT.md` — this file.  
- **Deleted:** `frontend/src/components/CalendarHeader.tsx`.
