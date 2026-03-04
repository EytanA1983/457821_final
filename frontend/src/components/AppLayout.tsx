import React, { useEffect, useRef, useState } from "react";
import "./AppLayout.css";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRooms } from "../hooks/useRooms";
import { useTasks } from "../hooks/useTasks";
import { hasTokens } from "../utils/tokenStorage";
import { ROUTES, getRoomRoute } from "../utils/routes";
import { Modal } from "./Modal";

const LOCKED_TABS = [
  { id: "locked-home", label: "היום", path: ROUTES.HOME },
  { id: "locked-rooms", label: "חדרים", path: ROUTES.ROOMS },
  { id: "locked-tasks", label: "משימות", path: ROUTES.ALL_TASKS },
  { id: "locked-calendar", label: "יומן", path: ROUTES.CALENDAR },
];

const CORE_TABS = [
  { id: "core-dashboard", label: "דשבורד", path: ROUTES.DASHBOARD },
  { id: "core-rooms", label: "חדרים", path: ROUTES.ROOMS },
  { id: "core-calendar", label: "יומן", path: ROUTES.CALENDAR },
];

const FOCUS_PRESETS = [5, 10, 15, 25];

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function AppLayout() {
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
  const [dailyTip] = useState("רק 5 דקות בחדר אחד יוצרות שקט גדול לכל הבית.");

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
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

  const isRoomsIndexActive = location.pathname === ROUTES.ROOMS;
  const showDynamicRoomTabs = isAuthenticated && rooms.length > 0;
  const selectedTask = pendingTasks.find((task: any) => String(task.id) === selectedTaskId);
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
  const isCoreTabActive = (path: string) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === ROUTES.HOME || location.pathname === ROUTES.DASHBOARD;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="appPageBg">
      <div className="app-topbar">
        <div className="app-topbar-inner">
          <div className="app-actions">
            {user && (
              <>
                <button className="pill-btn pill-btn-accent" onClick={() => setIsFocusModalOpen(true)}>
                  ✨ Spark Joy
                </button>
                <button onClick={logout} className="pill-btn">
                  התנתק
                </button>
              </>
            )}
          </div>

          <div className="app-logo">
            <img className="brandLogo" src="/branding/logo.png" alt="Eli Maor — The Art of Tidying" />
          </div>
        </div>
      </div>

      <div className="roomsNavWrap">
        <div className="app-container" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <nav ref={tabsRef} className="roomsTabs" aria-label="Rooms navigation">
            {isAuthenticated
              ? CORE_TABS.map((tab) => (
                  <Link
                    key={tab.id}
                    to={tab.path}
                    className={`roomTab ${isCoreTabActive(tab.path) ? "roomTabActive" : ""}`}
                  >
                    {tab.label}
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
                      title="נדרש להתחבר"
                    >
                      🔒 {tab.label}
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
                  כל החדרים
                </button>
                {rooms.map((room: any) => {
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
            aria-label="כל החדרים"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roomsDrawerHeader">
              <div className="wow-title" style={{ fontSize: 24 }}>כל החדרים</div>
              <button
                type="button"
                className="wow-btn"
                onClick={() => setIsRoomsDrawerOpen(false)}
                aria-label="סגירה"
              >
                סגור
              </button>
            </div>

            <div className="roomsDrawerList">
              <Link
                to={ROUTES.ROOMS}
                className={`roomsDrawerItem ${isRoomsIndexActive ? "roomsDrawerItemActive" : ""}`}
              >
                לעמוד כל החדרים
              </Link>
              {rooms.map((room: any) => {
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
        <Modal title="Spark Joy Timer" onClose={() => setIsFocusModalOpen(false)}>
          <div className="focusTimerWrap" dir="rtl">
            <p className="focusTimerIntro">
              בוחרות משימה קטנה אחת, מגדירות זמן מדויק, ורואות אם עמדנו בזמן. המטרה: התקדמות קצרה ועקבית.
            </p>

            <label className="focusTimerLabel" htmlFor="focus-task-select">משימה לפוקוס</label>
            <select
              id="focus-task-select"
              className="focusTimerSelect"
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              disabled={isTimerRunning}
            >
              <option value="">בחירה ידנית</option>
              {pendingTasks.slice(0, 20).map((task: any) => (
                <option key={task.id} value={String(task.id)}>
                  {task.title}
                </option>
              ))}
            </select>

            <div className="focusTimerPresets" aria-label="בחירת זמן">
              {FOCUS_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`focusPresetBtn ${durationMin === mins ? "focusPresetBtnActive" : ""}`}
                  onClick={() => setDurationMin(mins)}
                  disabled={isTimerRunning}
                >
                  {mins} דק'
                </button>
              ))}
            </div>

            <div className="focusTimerClock">{formatTimer(displayedSeconds)}</div>
            <div className="focusTimerProgress">
              <div className="focusTimerProgressBar" style={{ width: `${progressPct}%` }} />
            </div>

            <p className="focusTimerMeta">
              {selectedTask ? `משימה נבחרת: ${selectedTask.title}` : "טיפ: בחרי משימה קטנה וקונקרטית כדי להצליח בזמן."}
            </p>

            {lastTimerDoneAt && (
              <p className="focusTimerSuccess">כל הכבוד! עמדת בזמן. אפשר לסמן את המשימה ולהמשיך בקטנה.</p>
            )}

            <div className="focusTimerActions">
              {!isTimerRunning ? (
                <button type="button" className="wow-btn wow-btnPrimary" onClick={startFocusTimer}>
                  התחילי טיימר
                </button>
              ) : (
                <button type="button" className="wow-btn wow-btnPrimary" onClick={stopFocusTimer}>
                  עצירה
                </button>
              )}
              <button type="button" className="wow-btn" onClick={resetFocusTimer}>
                איפוס
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="app-container">
        <section className="brandStrip wow-card wow-pad wow-fadeIn" dir="rtl" aria-label="אלי מאור">
          <div className="brandStripTop">
            <div>
              <div className="wow-title brandSlogan">רק 5 דקות. משימה אחת. שינוי גדול.</div>
              <p className="wow-muted brandSubline">
                בוחרות משימה אחת בכל פעם. שקט בבית = שקט בראש.
              </p>
            </div>
            <a
              href="https://www.youtube.com/@EliMaor555"
              target="_blank"
              rel="noreferrer"
              className="wow-btn wow-btnPrimary"
            >
              צפי בסרטון קצר
            </a>
          </div>

          <div className="brandMetaRow">
            <div className="brandMetaCard">
              <span className="wow-chip wow-chipAccent">Tip יומי של אלי</span>
              <p className="brandMetaText">{dailyTip}</p>
            </div>
            <div className="brandMetaCard">
              <span className="wow-chip">התקדמות רכה</span>
              <p className="brandMetaText">
                היום סימנת {completedTasks.length} משימות — כל הכבוד, ממשיכים בקטנה.
              </p>
            </div>
          </div>
        </section>

        <Outlet />
      </div>

      <footer className="appFooter" dir="rtl" aria-label="Footer image" />
    </div>
  );
}
