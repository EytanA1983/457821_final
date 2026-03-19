import { useEffect, useState } from "react";
import api from "../api";
import { CalendarEvent } from "../schemas/calendar";
import { getAccessToken } from "../utils/tokenStorage";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";

// Simple date formatting without date-fns
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const GoogleCalendarHeader = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        title: "Calendar",
        googleTitle: "Google Calendar",
        connectSub: "Connect your calendar to make your day easier.",
        connect: "Connect Google",
        empty: "No events right now — perfect time for a calm reset.",
        untitled: "Untitled event",
      }
    : {
        title: "יומן",
        googleTitle: "יומן Google",
        connectSub: "נחבר יומן כדי להפוך את היום לקל יותר.",
        connect: "חיבור גוגל",
        empty: "כרגע אין אירועים — וזה זמן מצוין לנשימה קטנה וסדר רגוע.",
        untitled: "אירוע ללא שם",
      };
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarUnavailable, setCalendarUnavailable] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);

  const connectGoogleCalendar = async () => {
    try {
      const { data } = await api.get<{ auth_url?: string }>("/auth/google/login");
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
    } catch {
      // Fallback to settings screen if auth URL is not available.
    }
    window.location.href = ROUTES.SETTINGS;
  };

  useEffect(() => {
    if (!getAccessToken()) {
      setEvents([]);
      setAuthMissing(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    api
      .get<CalendarEvent[]>("/google-calendar/events?limit=5")
      .then((r) => {
        if (!isMounted) return;
        setEvents(r.data || []);
        setAuthMissing(false);
        setCalendarUnavailable(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        const status = err?.response?.status;
        if (status === 404 || status === 401 || status === 403) {
          setCalendarUnavailable(true);
        }
        if (status === 401 || status === 403) {
          setAuthMissing(true);
        }
        setEvents([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 10 }}>{text.title}</div>
        <div className="wow-skeleton" style={{ height: 14, width: "70%", marginBottom: 10 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "92%", marginBottom: 8 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "86%", marginBottom: 8 }} />
        <div className="wow-skeleton" style={{ height: 12, width: "78%" }} />
      </div>
    );
  }

  if (authMissing || calendarUnavailable) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 8 }}>{text.googleTitle}</div>
        <div className="wow-muted" style={{ marginBottom: 14 }}>
          {text.connectSub}
        </div>
        <button type="button" className="wow-btn wow-btnPrimary" onClick={connectGoogleCalendar}>
          {text.connect}
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="wow-title" style={{ fontSize: 18, marginBottom: 8 }}>{text.googleTitle}</div>
        <div className="wow-muted">{text.empty}</div>
      </div>
    );
  }

  return (
    <div className="wow-card wow-pad wow-fadeIn" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="wow-title" style={{ fontSize: 18, marginBottom: 10 }}>{text.googleTitle}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {events.map((ev) => (
          <div
            key={ev.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px 12px",
              background: "var(--card)",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {ev.summary ?? text.untitled}
            </span>
            <span className="wow-muted" style={{ fontSize: 12 }}>
              {formatDate(ev.start)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
