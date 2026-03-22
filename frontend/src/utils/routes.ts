/**
 * App routes — single source for paths and legacy compatibility helpers.
 */
import type { ProductCategoryKey } from "../domain/productCategories";
import { inferProductCategoryFromRoomName } from "../domain/productCategories";

export const ROUTES = {
  // Public routes
  LOGIN: "/login",
  REGISTER: "/register",
  GOOGLE_CALLBACK: "/auth/google/callback",

  // Protected routes
  HOME: "/", // Home hub
  DASHBOARD: "/dashboard",
  /** Product categories (UI successor to "rooms" list) */
  CATEGORIES: "/categories",
  CATEGORY: "/categories/:categoryKey",
  /**
   * Legacy storage areas (DB `rooms`). Kept for deep links + unmapped names.
   * List path redirects to `CATEGORIES`; detail may redirect when mappable.
   */
  ROOMS: "/rooms",
  ROOM: "/rooms/:roomId",
  HOUSE_VIEW: "/house",
  ALL_TASKS: "/tasks",
  ADD_TASK: "/tasks/new",
  INVENTORY: "/inventory",
  EMOTIONAL_JOURNAL: "/emotional-journal",
  CONTENT_HUB: "/content-hub",
  SETTINGS: "/settings",
  /** לוח חזון — מחברת השראה מקומית (טקסט/תמונות); היומן ב-Google ב־CALENDAR */
  MY_VISION_BOARD: "/vision",
  CALENDAR: "/calendar",
  SHOPPING_LISTS: "/shopping",
  SHOPPING_LIST_CREATE: "/shopping/new",
} as const;

export const isProtectedRoute = (path: string): boolean => {
  return (
    path !== ROUTES.LOGIN &&
    path !== ROUTES.REGISTER &&
    path !== ROUTES.GOOGLE_CALLBACK
  );
};

/** Detail URL for a canonical product category. */
export function getCategoryRoute(categoryKey: ProductCategoryKey): string {
  return `${ROUTES.CATEGORIES}/${categoryKey}`;
}

/**
 * Legacy helper — numeric DB room id (still used by API).
 * Prefer `resolveAreaPath` for navigation from a known name.
 */
export const getRoomRoute = (roomId: number | string): string => {
  return `${ROUTES.ROOMS}/${roomId}`;
};

/**
 * Prefer category URL when the legacy name maps cleanly; otherwise keep `/rooms/:id`.
 */
export function resolveAreaPath(room: { id: number; name: string }): string {
  const cat = inferProductCategoryFromRoomName(room.name);
  if (cat) return getCategoryRoute(cat);
  return getRoomRoute(room.id);
}
