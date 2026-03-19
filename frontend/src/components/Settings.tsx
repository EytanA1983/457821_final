import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { registerPush, unregisterPush } from '../utils/push';
import { GoogleLoginButton } from './GoogleLoginButton';
import { ThemeToggleWithLabel } from './ThemeToggle';
import { useVoice } from '../hooks/useVoice';
import { useRooms } from '../hooks/useRooms';
import api from '../api';
import { showError, showSuccess } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import type { RoomRead } from '../schemas/room';

export const Settings = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        settings: "Settings",
        pushTitle: "Push notifications",
        pushEnabledSpeak: "Push notifications enabled",
        pushEnableFailedSpeak: "Push setup failed",
        pushDisabledSpeak: "Push notifications disabled",
        pushDisableFailedSpeak: "Failed to disable notifications",
        disableNotifications: "Disable notifications",
        enableNotifications: "Enable notifications",
        googleCalendarSync: "Google Calendar sync",
        displayTitle: "Display",
        displayText: "Theme colors are loaded from Tailwind config and can be customized in tailwind.config.ts",
        shareSuccess: "Household user added successfully.",
        shareFail: "Failed to add household user.",
        sharingTitle: "Household sharing",
        sharingSub: "Add another user from your home by email and let them view room tasks.",
        selectRoom: "Select room",
        emailPlaceholder: "family@email.com",
        adding: "Adding...",
        addUser: "Add household user",
      }
    : {
        settings: "הגדרות",
        pushTitle: "התראות פוש",
        pushEnabledSpeak: "קיבלת התראות פוש",
        pushEnableFailedSpeak: "ההגדרה נכשלה",
        pushDisabledSpeak: "הפוש נוטרל",
        pushDisableFailedSpeak: "ביטול התראות נכשל",
        disableNotifications: "בטל התראות",
        enableNotifications: "הפעל התראות",
        googleCalendarSync: "סינכרון ל‑Google Calendar",
        displayTitle: "תצוגה",
        displayText: "הצבעים המוגדרים כבר נטענים מה‑Tailwind – ניתן לשנות בקובץ tailwind.config.ts",
        shareSuccess: "המשתמש נוסף לבית בהצלחה.",
        shareFail: "לא הצלחנו להוסיף משתמש לבית.",
        sharingTitle: "שיתוף בני בית",
        sharingSub: "הוסיפי משתמש נוסף מהבית לפי אימייל כדי לשתף משימות חדרים.",
        selectRoom: "בחרי חדר",
        emailPlaceholder: "משתמש@אימייל.com",
        adding: "מוסיף...",
        addUser: "הוספת משתמש לבית",
      };
  const [pushEnabled, setPushEnabled] = useState(false);
  const { speak } = useVoice();
  const { data: rooms = [] } = useRooms();
  const [shareRoomId, setShareRoomId] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const enablePush = async () => {
    try {
      await registerPush();
      setPushEnabled(true);
      speak(t.pushEnabledSpeak);
    } catch (e) {
      console.error(e);
      speak(t.pushEnableFailedSpeak);
    }
  };

  const disablePush = async () => {
    // כאן אפשר לקבל את המנוי מה‑indexedDB או לשמור את ה‑endpoint במשתנה גלובלי.
    // נניח שמאוחסן ב‑localStorage
    const endpoint = localStorage.getItem('push_endpoint');
    if (endpoint) {
      try {
        await unregisterPush(endpoint);
        setPushEnabled(false);
        speak(t.pushDisabledSpeak);
      } catch (e) {
        console.error(e);
        speak(t.pushDisableFailedSpeak);
      }
    }
  };

  // בדיקה ראשונית אם כבר קיים subscription
  useEffect(() => {
    // ניתוח של subscription קיים ב‑navigator.serviceWorker
    const check = async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setPushEnabled(true);
        localStorage.setItem('push_endpoint', sub.endpoint);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    check();
  }, []);

  const shareByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareRoomId || !shareEmail.trim()) return;
    setShareLoading(true);
    try {
      await api.post(`/sharing/rooms/${shareRoomId}/share-by-email`, {
        email: shareEmail.trim(),
        permission: "viewer",
      });
      showSuccess(t.shareSuccess);
      setShareEmail("");
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      showError(axiosError?.response?.data?.detail ?? t.shareFail);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 bg-cream dark:bg-dark-bg min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t.settings}</h2>

      {/* Theme Toggle */}
      <section>
        <ThemeToggleWithLabel />
      </section>

      <section>
        <h3 className="font-medium">{t.pushTitle}</h3>
        {pushEnabled ? (
          <button onClick={disablePush} className="btn btn-red">
            {t.disableNotifications}
          </button>
        ) : (
          <button onClick={enablePush} className="btn btn-sky">
            {t.enableNotifications}
          </button>
        )}
      </section>

      <section>
        <h3 className="font-medium">{t.googleCalendarSync}</h3>
        <GoogleLoginButton />
      </section>

      <section>
        <h3 className="font-medium">{t.displayTitle}</h3>
        <p>{t.displayText}</p>
      </section>

      <section className="wow-card wow-pad" dir={isEnglish ? "ltr" : "rtl"}>
        <h3 className="font-medium mb-2">{t.sharingTitle}</h3>
        <p className="wow-muted mb-3">{t.sharingSub}</p>
        <form onSubmit={shareByEmail} style={{ display: "grid", gap: 8 }}>
          <select
            className="input"
            value={shareRoomId ?? ""}
            onChange={(e) => setShareRoomId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.selectRoom}</option>
            {rooms.map((room: RoomRead) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
          />
          <button type="submit" className="wow-btn wow-btnPrimary" disabled={shareLoading}>
            {shareLoading ? t.adding : t.addUser}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Settings;
