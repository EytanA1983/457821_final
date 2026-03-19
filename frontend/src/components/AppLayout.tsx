import { useEffect, useRef, useState } from "react";
import "./AppLayout.css";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useRooms } from "../hooks/useRooms";
import { useTasks } from "../hooks/useTasks";
import { hasTokens } from "../utils/tokenStorage";
import { ROUTES, getRoomRoute } from "../utils/routes";
import { Modal } from "./Modal";
import type { RoomRead } from "../schemas/room";
import type { TaskRead } from "../schemas/task";

const LOCKED_TABS = [
  { id: "locked-home", labelKey: "today", path: ROUTES.HOME },
  { id: "locked-rooms", labelKey: "rooms", path: ROUTES.ROOMS },
  { id: "locked-tasks", labelKey: "tasks", path: ROUTES.ALL_TASKS },
  { id: "locked-calendar", labelKey: "calendar", path: ROUTES.CALENDAR },
  { id: "locked-inventory", labelKey: "inventory", path: ROUTES.INVENTORY },
  { id: "locked-emotional", labelKey: "emotional", path: ROUTES.EMOTIONAL_JOURNAL },
  { id: "locked-content", labelKey: "contentHub", path: ROUTES.CONTENT_HUB },
];

const CORE_TABS = [
  { id: "core-dashboard", labelKey: "dashboard", path: ROUTES.DASHBOARD },
  { id: "core-rooms", labelKey: "rooms", path: ROUTES.ROOMS },
  { id: "core-calendar", labelKey: "calendar", path: ROUTES.CALENDAR },
  { id: "core-inventory", labelKey: "inventory", path: ROUTES.INVENTORY },
  { id: "core-emotional", labelKey: "emotional", path: ROUTES.EMOTIONAL_JOURNAL },
  { id: "core-content", labelKey: "contentHub", path: ROUTES.CONTENT_HUB },
];

const FOCUS_PRESETS = [5, 10, 15, 25];

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function AppLayout() {
  const { i18n } = useTranslation();
  const { user, logout } = useAuth();
  const isAuthenticated = hasTokens();
  const { data: rooms = [] } = useRooms({ enabled: isAuthenticated });
  const { data: completedTasks = [] } = useTasks({ completed: true }, { enabled: isAuthenticated });
  const { data: pendingTasks = [] } = useTasks({ completed: false }, { enabled: isAuthenticated });
  const location = useLocation();
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLElement | null>(null);
  const [isRoomsDrawerOpen, setIsRoomsDrawerOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [durationMin, setDurationMin] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [lastTimerDoneAt, setLastTimerDoneAt] = useState<number | null>(null);
  const currentLang = i18n.resolvedLanguage || i18n.language || "he";
  const isEnglish = currentLang.startsWith("en");
  const isRtl = !isEnglish;
  const uiText = isEnglish
    ? {
        today: "Today",
        dashboard: "Dashboard",
        rooms: "Rooms",
        tasks: "Tasks",
        calendar: "Calendar",
        inventory: "Inventory",
        emotional: "Emotional",
        contentHub: "Content",
        allRooms: "All Rooms",
        allRoomsTitle: "All Rooms",
        roomsPage: "All Rooms Page",
        loginRequired: "Login required",
        close: "Close",
        logout: "Logout",
        watchVideo: "Watch a short video",
        languageToggle: "עברית",
        dailyTipLabel: "Eli's Daily Tip",
        progressSoft: "Gentle progress",
        progressText: (count: number) => `Today you checked ${count} tasks — great job, keep it simple.`,
        dailyTipText: "Just 5 minutes in one room creates calm for the whole home.",
        brandAriaLabel: "Eli Maor brand strip",
        brandTitle: "Just 5 minutes. One task. Big change.",
        brandSubline: "One task at a time. Calm home = calm mind.",
        focusTitle: "Spark Joy Timer",
        focusIntro:
          "Choose one small task, set an exact time, and see if you can finish on time. The goal: short and steady progress.",
        focusTask: "Focus task",
        focusDuration: "Duration selection",
        focusManual: "Manual choice",
        focusHint: "Tip: pick a small, concrete task to finish on time.",
        focusSelected: (name: string) => `Selected task: ${name}`,
        focusSuccess: "Great work! You finished on time. Mark it done and keep going.",
        startTimer: "Start timer",
        stopTimer: "Stop",
        reset: "Reset",
        toggleLanguage: "Toggle language",
        roomsNavigation: "Rooms navigation",
      }
    : {
        today: "היום",
        dashboard: "דשבורד",
        rooms: "חדרים",
        tasks: "משימות",
        calendar: "יומן",
        inventory: "קטלוג",
        emotional: "רגשי",
        contentHub: "תוכן",
        allRooms: "כל החדרים",
        allRoomsTitle: "כל החדרים",
        roomsPage: "לעמוד כל החדרים",
        loginRequired: "נדרש להתחבר",
        close: "סגור",
        logout: "התנתק",
        watchVideo: "צפי בסרטון קצר",
        languageToggle: "English",
        dailyTipLabel: "טיפ יומי של אלי",
        progressSoft: "התקדמות רכה",
        progressText: (count: number) => `היום סימנת ${count} משימות — כל הכבוד, ממשיכים בקטנה.`,
        dailyTipText: "רק 5 דקות בחדר אחד יוצרות שקט גדול לכל הבית.",
        brandAriaLabel: "מיתוג אלי מאור",
        brandTitle: "רק 5 דקות. משימה אחת. שינוי גדול.",
        brandSubline: "בוחרות משימה אחת בכל פעם. שקט בבית = שקט בראש.",
        focusTitle: "Spark Joy Timer",
        focusIntro: "בוחרות משימה קטנה אחת, מגדירות זמן מדויק, ורואות אם עמדנו בזמן. המטרה: התקדמות קצרה ועקבית.",
        focusTask: "משימה לפוקוס",
        focusDuration: "בחירת זמן",
        focusManual: "בחירה ידנית",
        focusHint: "טיפ: בחרי משימה קטנה וקונקרטית כדי להצליח בזמן.",
        focusSelected: (name: string) => `משימה נבחרת: ${name}`,
        focusSuccess: "כל הכבוד! עמדת בזמן. אפשר לסמן את המשימה ולהמשיך בקטנה.",
        startTimer: "התחילי טיימר",
        stopTimer: "עצירה",
        reset: "איפוס",
        toggleLanguage: "החלפת שפה",
        roomsNavigation: "ניווט חדרים",
      };
  const dailyTip = uiText.dailyTipText;

  const getTabLabel = (labelKey: string): string => {
    const v = uiText[labelKey as keyof typeof uiText];
    return typeof v === "string" ? v : labelKey;
  };

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    const active = el.querySelector(".roomTabActive") as HTMLElement | null;
    if (!active) return;

    active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [location.pathname]);

  useEffect(() => {
    setIsRoomsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isRoomsDrawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRoomsDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isRoomsDrawerOpen]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          setIsTimerRunning(false);
          setLastTimerDoneAt(Date.now());
          try {
            const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.36);
          } catch {
            // Ignore audio failures (browser policy / unsupported context).
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [isTimerRunning]);

  useEffect(() => {
    document.documentElement.lang = isEnglish ? "en" : "he";
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isEnglish, isRtl]);

  const isRoomsIndexActive = location.pathname === ROUTES.ROOMS;
  const showDynamicRoomTabs = isAuthenticated && rooms.length > 0;
  const selectedTask = pendingTasks.find((task: TaskRead) => String(task.id) === selectedTaskId);
  const progressPct =
    totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100)) : 0;
  const displayedSeconds = totalSeconds > 0 ? secondsLeft : durationMin * 60;

  const startFocusTimer = () => {
    const total = durationMin * 60;
    setTotalSeconds(total);
    setSecondsLeft(total);
    setLastTimerDoneAt(null);
    setIsTimerRunning(true);
  };

  const stopFocusTimer = () => {
    setIsTimerRunning(false);
  };

  const resetFocusTimer = () => {
    setIsTimerRunning(false);
    setSecondsLeft(0);
    setTotalSeconds(0);
    setLastTimerDoneAt(null);
  };

  const toggleLanguage = () => {
    const nextLang = isEnglish ? "he" : "en";
    void i18n.changeLanguage(nextLang);
  };
  const isCoreTabActive = (path: string) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === ROUTES.HOME || location.pathname === ROUTES.DASHBOARD;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="appPageBg" dir={isRtl ? "rtl" : "ltr"}>
      <div className="app-topbar">
        <div className="app-topbar-inner">
          {/* Language toggle - left side */}
          <div className="app-language-toggle">
            <button className="pill-btn" onClick={toggleLanguage} aria-label={uiText.toggleLanguage}>
              {uiText.languageToggle}
            </button>
          </div>

          {/* Logo - center */}
          <div className="app-logo">
            <img className="brandLogo" src="/branding/logo.png" alt="Eli Maor — The Art of Tidying" />
          </div>

          {/* Actions - right side */}
          <div className="app-actions">
            {user && (
              <>
                <button className="pill-btn pill-btn-accent" onClick={() => setIsFocusModalOpen(true)}>
                  ✨ Spark Joy
                </button>
                <button onClick={logout} className="pill-btn">
                  {uiText.logout}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="roomsNavWrap">
        <div className="app-container" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <nav ref={tabsRef} className="roomsTabs" aria-label={uiText.roomsNavigation}>
            {isAuthenticated
              ? CORE_TABS.map((tab) => (
                  <Link
                    key={tab.id}
                    to={tab.path}
                    className={`roomTab ${isCoreTabActive(tab.path) ? "roomTabActive" : ""}`}
                  >
                    {getTabLabel(tab.labelKey)}
                  </Link>
                ))
              : LOCKED_TABS.map((tab) => {
                  const isActive = location.pathname === tab.path;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`roomTab roomTabLocked ${isActive ? "roomTabActive" : ""}`}
                      onClick={() => navigate(ROUTES.LOGIN, { state: { from: tab.path } })}
                      title={uiText.loginRequired}
                    >
                      🔒 {getTabLabel(tab.labelKey)}
                    </button>
                  );
                })}

            {showDynamicRoomTabs && (
              <>
                <button
                  type="button"
                  className={`roomTab roomsDrawerTrigger ${isRoomsDrawerOpen ? "roomTabActive" : ""}`}
                  onClick={() => setIsRoomsDrawerOpen(true)}
                >
                  {uiText.allRooms}
                </button>
                {rooms.map((room: RoomRead) => {
                  const roomPath = getRoomRoute(room.id);
                  const isActive = location.pathname === roomPath;
                  return (
                    <Link
                      key={room.id}
                      to={roomPath}
                      className={`roomTab ${isActive ? "roomTabActive" : ""}`}
                    >
                      {room.name}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </div>
      </div>

      {showDynamicRoomTabs && isRoomsDrawerOpen && (
        <div
          className="roomsDrawerBackdrop"
          onClick={() => setIsRoomsDrawerOpen(false)}
          role="presentation"
        >
          <aside
            className="roomsDrawerPanel"
            role="dialog"
            aria-modal="true"
            aria-label={uiText.allRoomsTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roomsDrawerHeader">
              <div className="wow-title" style={{ fontSize: 24 }}>{uiText.allRoomsTitle}</div>
              <button
                type="button"
                className="wow-btn"
                onClick={() => setIsRoomsDrawerOpen(false)}
                aria-label={uiText.close}
              >
                {uiText.close}
              </button>
            </div>

            <div className="roomsDrawerList">
              <Link
                to={ROUTES.ROOMS}
                className={`roomsDrawerItem ${isRoomsIndexActive ? "roomsDrawerItemActive" : ""}`}
              >
                {uiText.roomsPage}
              </Link>
              {rooms.map((room: RoomRead) => {
                const roomPath = getRoomRoute(room.id);
                const isActive = location.pathname === roomPath;
                return (
                  <Link
                    key={`drawer-room-${room.id}`}
                    to={roomPath}
                    className={`roomsDrawerItem ${isActive ? "roomsDrawerItemActive" : ""}`}
                  >
                    {room.name}
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {isFocusModalOpen && (
        <Modal title={uiText.focusTitle} onClose={() => setIsFocusModalOpen(false)}>
          <div className="focusTimerWrap" dir={isRtl ? "rtl" : "ltr"}>
            <p className="focusTimerIntro">
              {uiText.focusIntro}
            </p>

            <label className="focusTimerLabel" htmlFor="focus-task-select">{uiText.focusTask}</label>
            <select
              id="focus-task-select"
              className="focusTimerSelect"
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              disabled={isTimerRunning}
            >
              <option value="">{uiText.focusManual}</option>
              {pendingTasks.slice(0, 20).map((task: TaskRead) => (
                <option key={task.id} value={String(task.id)}>
                  {task.title}
                </option>
              ))}
            </select>

            <div className="focusTimerPresets" aria-label={uiText.focusDuration}>
              {FOCUS_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`focusPresetBtn ${durationMin === mins ? "focusPresetBtnActive" : ""}`}
                  onClick={() => setDurationMin(mins)}
                  disabled={isTimerRunning}
                >
                  {isEnglish ? `${mins} min` : `${mins} דק'`}
                </button>
              ))}
            </div>

            <div className="focusTimerClock">{formatTimer(displayedSeconds)}</div>
            <div className="focusTimerProgress">
              <div className="focusTimerProgressBar" style={{ width: `${progressPct}%` }} />
            </div>

            <p className="focusTimerMeta">
              {selectedTask ? uiText.focusSelected(selectedTask.title) : uiText.focusHint}
            </p>

            {lastTimerDoneAt && (
              <p className="focusTimerSuccess">{uiText.focusSuccess}</p>
            )}

            <div className="focusTimerActions">
              {!isTimerRunning ? (
                <button type="button" className="wow-btn wow-btnPrimary" onClick={startFocusTimer}>
                  {uiText.startTimer}
                </button>
              ) : (
                <button type="button" className="wow-btn wow-btnPrimary" onClick={stopFocusTimer}>
                  {uiText.stopTimer}
                </button>
              )}
              <button type="button" className="wow-btn" onClick={resetFocusTimer}>
                {uiText.reset}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="app-container">
        <section className="brandStrip wow-card wow-pad wow-fadeIn" dir={isRtl ? "rtl" : "ltr"} aria-label={uiText.brandAriaLabel}>
          <div className="brandStripTop">
            <div>
              <div className="wow-title brandSlogan">{uiText.brandTitle}</div>
              <p className="wow-muted brandSubline">
                {uiText.brandSubline}
              </p>
            </div>
          </div>

          <div className="brandMetaRow">
            <div className="brandMetaCard">
              <span className="wow-chip wow-chipAccent">{uiText.dailyTipLabel}</span>
              <p className="brandMetaText">{dailyTip}</p>
            </div>
            <div className="brandMetaCard">
              <span className="wow-chip">{uiText.progressSoft}</span>
              <p className="brandMetaText">
                {uiText.progressText(completedTasks.length)}
              </p>
            </div>
          </div>
        </section>

        <Outlet />
      </div>

      <footer className="appFooter" dir={isRtl ? "rtl" : "ltr"} aria-label="Footer image" />
    </div>
  );
}
