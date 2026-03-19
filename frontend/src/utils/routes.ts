/**
 * קבועי ניתוב - כל הנתיבים של האפליקציה
 * שימוש: import { ROUTES } from '../utils/routes';
 */
export const ROUTES = {
  // Public routes
  LOGIN: '/login',
  REGISTER: '/register',
  GOOGLE_CALLBACK: '/auth/google/callback',

  // Protected routes
  HOME: '/',                // מסך הבית (redirects to dashboard)
  DASHBOARD: '/dashboard',  // דשבורד מרכזי אחרי כניסה
  ROOMS: '/rooms',          // רשימת כל החדרים
  ROOM: '/rooms/:id',       // פרטי חדר - משימות של החדר
  HOUSE_VIEW: '/house',     // תצוגת בית (SVG) - בחירת חדרים
  ALL_TASKS: '/tasks',      // כל המשימות
  ADD_TASK: '/tasks/new',   // אפשרות להוסיף משימה
  INVENTORY: '/inventory',
  EMOTIONAL_JOURNAL: '/emotional-journal',
  CONTENT_HUB: '/content-hub',
  SETTINGS: '/settings',
  CALENDAR: '/calendar',
  SHOPPING_LISTS: '/shopping',
  SHOPPING_LIST_CREATE: '/shopping/new',
} as const;

/**
 * Helper function to check if a route is protected
 */
export const isProtectedRoute = (path: string): boolean => {
  return path !== ROUTES.LOGIN &&
         path !== ROUTES.REGISTER &&
         path !== ROUTES.GOOGLE_CALLBACK;
};

/**
 * Helper function to get room route
 * Uses /rooms/:roomId format
 */
export const getRoomRoute = (roomId: number | string): string => {
  return `${ROUTES.ROOMS}/${roomId}`;
};
