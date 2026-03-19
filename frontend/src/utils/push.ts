import api from '../api';
import { showError, showSuccess } from './toast';

export const registerPush = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push not supported');
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });

    await api.post('/notifications/subscribe', subscription);
    
    // שמירת endpoint ב-localStorage רק אחרי הצלחה
    localStorage.setItem('push_endpoint', subscription.endpoint);
    showSuccess('התראות Push הופעלו בהצלחה');
  } catch (error: any) {
    console.error('Error registering push:', error);
    const errorMessage = error.message || 'שגיאה בהרשמה להתראות Push';
    showError(errorMessage);
    throw error; // Re-throw to allow caller to handle
  }
};

export const unregisterPush = async (endpoint: string) => {
  try {
    // Unsubscribe from Service Worker first
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }
    
    // Then notify backend
    await api.post('/notifications/unsubscribe', { endpoint });
    
    // Remove endpoint from localStorage only after successful unsubscription
    localStorage.removeItem('push_endpoint');
    showSuccess('התראות Push בוטלו בהצלחה');
  } catch (error: any) {
    console.error('Error unregistering push:', error);
    const errorMessage = error.message || 'שגיאה בביטול התראות Push';
    showError(errorMessage);
    throw error; // Re-throw to allow caller to handle
  }
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
