/**
 * Basic Analytics Utility
 * 
 * Optional analytics tracking for user actions and page views.
 * Can be extended to integrate with Google Analytics, Mixpanel, etc.
 */

type AnalyticsEvent = {
  name: string;
  properties?: Record<string, any>;
};

/**
 * Track a custom event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Only track in production or if explicitly enabled
  if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
    try {
      const event: AnalyticsEvent = {
        name: eventName,
        properties: properties || {},
      };

      // Log to console in development
      if (import.meta.env.DEV) {
        console.log('[Analytics]', event);
      }

      // TODO: Integrate with analytics service
      // Example: Google Analytics
      // if (typeof window !== 'undefined' && (window as any).gtag) {
      //   (window as any).gtag('event', eventName, properties);
      // }

      // Example: Custom analytics endpoint
      // fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // });
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  }
};

/**
 * Track page view
 */
export const trackPageView = (path: string) => {
  trackEvent('page_view', { path });
};

/**
 * Track user action
 */
export const trackAction = (action: string, details?: Record<string, any>) => {
  trackEvent('user_action', { action, ...details });
};

/**
 * Common event tracking functions
 */
export const analytics = {
  // Task events
  taskCreated: (taskId: number, roomId?: number) => {
    trackEvent('task_created', { taskId, roomId });
  },
  taskCompleted: (taskId: number) => {
    trackEvent('task_completed', { taskId });
  },
  taskDeleted: (taskId: number) => {
    trackEvent('task_deleted', { taskId });
  },

  // Room events
  roomCreated: (roomId: number, roomName: string) => {
    trackEvent('room_created', { roomId, roomName });
  },
  roomViewed: (roomId: number) => {
    trackEvent('room_viewed', { roomId });
  },

  // Calendar events
  calendarEventCreated: (eventId: string) => {
    trackEvent('calendar_event_created', { eventId });
  },
  taskFromEventCreated: (eventId: string, taskId: number) => {
    trackEvent('task_from_event_created', { eventId, taskId });
  },

  // Shopping list events
  shoppingListCreated: (listId: number) => {
    trackEvent('shopping_list_created', { listId });
  },
  shoppingItemAdded: (listId: number, itemId: number) => {
    trackEvent('shopping_item_added', { listId, itemId });
  },

  // Auth events
  userLoggedIn: (userId: number) => {
    trackEvent('user_logged_in', { userId });
  },
  userRegistered: (userId: number) => {
    trackEvent('user_registered', { userId });
  },
};

export default analytics;
