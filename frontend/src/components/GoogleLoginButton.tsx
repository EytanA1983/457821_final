import { useEffect } from 'react';
import api from '../api';

export const GoogleLoginButton = () => {
  // בדיקת URL parameters אחרי redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_success') === '1') {
      alert('החיבור ל-Google Calendar הושלם בהצלחה!');
      // ניקוי ה-URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_error') === '1') {
      alert('שגיאה בחיבור ל-Google Calendar. אנא נסה שוב.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const openOAuth = async () => {
    const { data } = await api.get('/auth/google/login');
    const popup = window.open(data.auth_url, 'google_oauth', 'width=500,height=600');

    if (!popup) {
      alert('חלון פופ-אפ נחסם. אנא אפשר חלונות פופ-אפ.');
      return;
    }

    // בדיקה אם החלון נסגר או הופנה ל-frontend
    const checkStatus = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkStatus);
        return;
      }

      try {
        // בדיקה אם ה-popup הופנה ל-frontend
        const popupUrl = popup.location.href;
        if (popupUrl.includes(window.location.origin)) {
          const url = new URL(popupUrl);
          if (url.searchParams.get('google_success') === '1') {
            clearInterval(checkStatus);
            popup.close();
            window.location.reload();
          } else if (url.searchParams.get('google_error') === '1') {
            clearInterval(checkStatus);
            popup.close();
            alert('שגיאה בחיבור ל-Google Calendar. אנא נסה שוב.');
          }
        }
      } catch (e) {
        // Cross-origin error - זה תקין, ה-popup עדיין ב-Google
      }
    }, 500);
  };

  // בפועל – ה‑callback של Google יחזיר למשתמש URL שמופנה ל‑/auth/google/callback
  // נשתמש ב‑window.opener.postMessage(...) באותו דף

  return (
    <button
      onClick={openOAuth}
      className="flex items-center space-x-2 bg-sky text-white px-4 py-2 rounded hover:bg-sky-600"
    >
      <img src="/google-icon.svg" alt="Google" className="h-5 w-5" />
      <span>סנכרן עם Google Calendar</span>
    </button>
  );
};

export default GoogleLoginButton;
