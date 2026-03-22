import { useEffect, useRef, useState } from "react";
import "./AppLayout.css";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { hasTokens } from "../utils/tokenStorage";
import { ROUTES } from "../utils/routes";
import { Modal } from "./Modal";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CategoriesNavTab } from "./CategoriesNavTab";
import { isRtlLang } from "../utils/localeDirection";

type ShellTab = {
  id: string;
  labelKey: string;
  path: string;
  /** Extra paths that keep this tab highlighted. */
  aliasPaths?: readonly string[];
};

const LOCKED_TABS: ShellTab[] = [
  { id: "locked-home", labelKey: "today", path: ROUTES.HOME },
  { id: "locked-categories", labelKey: "categories", path: ROUTES.CATEGORIES },
  { id: "locked-inventory", labelKey: "inventory", path: ROUTES.INVENTORY },
  { id: "locked-tasks", labelKey: "tasks", path: ROUTES.ALL_TASKS },
  { id: "locked-vision", labelKey: "visionScheduleTab", path: ROUTES.MY_VISION_BOARD },
  { id: "locked-journal", labelKey: "journalGoogleTab", path: ROUTES.CALENDAR },
];

const CORE_TABS: ShellTab[] = [
  { id: "core-dashboard", labelKey: "dashboard", path: ROUTES.DASHBOARD },
  { id: "core-categories", labelKey: "categories", path: ROUTES.CATEGORIES },
  { id: "core-inventory", labelKey: "inventory", path: ROUTES.INVENTORY },
  { id: "core-vision", labelKey: "visionScheduleTab", path: ROUTES.MY_VISION_BOARD },
  { id: "core-journal", labelKey: "journalGoogleTab", path: ROUTES.CALENDAR },
];

const FOCUS_PRESETS = [1, 5, 10, 15, 20, 25, 30];

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function AppLayout() {
  const { i18n } = useTranslation();
  const { t } = useTranslation("layout");
  const { user, logout } = useAuth();
  const isAuthenticated = hasTokens();
  const location = useLocation();
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLElement | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [pickDurationOpen, setPickDurationOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const coreLang = (i18n.language || "he").split("-")[0];
  const isRtl = isRtlLang(i18n.language);
  const getTabLabel = (labelKey: string): string => t(labelKey);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    const active = el.querySelector(".roomTabActive");
    if (!(active instanceof HTMLElement)) return;

    active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [location.pathname]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          setIsTimerRunning(false);
          setTotalSeconds(0);
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
    if (!isFocusModalOpen) return;
    setPickDurationOpen(false);
  }, [isFocusModalOpen]);

  useEffect(() => {
    document.documentElement.lang = coreLang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [coreLang, isRtl]);

  const progressPct =
    totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100)) : 0;
  const displayedSeconds = isTimerRunning || totalSeconds > 0 ? secondsLeft : 0;

  const startTimerWithPresetMinutes = (mins: number) => {
    const total = mins * 60;
    setTotalSeconds(total);
    setSecondsLeft(total);
    setPickDurationOpen(false);
    setIsTimerRunning(true);
  };

  const resetFocusTimer = () => {
    setIsTimerRunning(false);
    setSecondsLeft(0);
    setTotalSeconds(0);
    setPickDurationOpen(false);
  };

  const onStartClick = () => {
    if (isTimerRunning) return;
    setPickDurationOpen((open) => !open);
  };

  const isShellTabActive = (tab: ShellTab) => {
    const p = location.pathname;
    if (tab.aliasPaths?.some((a) => p === a || p.startsWith(`${a}/`))) {
      return true;
    }
    const path = tab.path;
    if (path === ROUTES.DASHBOARD) {
      return p === ROUTES.HOME || p === ROUTES.DASHBOARD;
    }
    if (path === ROUTES.CATEGORIES) {
      return (
        p === ROUTES.CATEGORIES ||
        p.startsWith(`${ROUTES.CATEGORIES}/`) ||
        p === ROUTES.ROOMS ||
        p.startsWith(`${ROUTES.ROOMS}/`)
      );
    }
    if (path === ROUTES.MY_VISION_BOARD) {
      return p === path || p.startsWith(`${path}/`);
    }
    if (path === ROUTES.CALENDAR) {
      return p === path || p.startsWith(`${path}/`);
    }
    return p === path || p.startsWith(`${path}/`);
  };

  return (
    <div className="appPageBg" dir={isRtl ? "rtl" : "ltr"}>
      <div className="app-topbar">
        <div className="app-topbar-inner">
          {/* Language toggle - left side */}
          <div className="app-language-toggle">
            <LanguageSwitcher mode="compact" className="pill-btn" />
          </div>

          {/* Logo - center */}
          <div className="app-logo">
            <img className="brandLogo" src="/branding/logo.png" alt={t("logoAlt")} />
          </div>

          {/* Actions - right side */}
          <div className="app-actions">
            {user && (
              <>
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() => setIsFocusModalOpen(true)}
                  aria-label={t("focusTimerOpenAria")}
                >
                  {t("focusTimerBtn")}
                </button>
                <button type="button" onClick={logout} className="pill-btn">
                  {t("logout")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="roomsNavWrap">
        <div className="app-container" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <nav ref={tabsRef} className="roomsTabs" aria-label={t("mainNavigation")}>
            {isAuthenticated
              ? CORE_TABS.map((tab) =>
                  tab.path === ROUTES.CATEGORIES ? (
                    <CategoriesNavTab
                      key={tab.id}
                      authenticated
                      tabLabel={getTabLabel(tab.labelKey)}
                      isActive={isShellTabActive(tab)}
                    />
                  ) : (
                    <Link
                      key={tab.id}
                      to={tab.path}
                      className={`roomTab ${isShellTabActive(tab) ? "roomTabActive" : ""}`}
                    >
                      {getTabLabel(tab.labelKey)}
                    </Link>
                  ),
                )
              : LOCKED_TABS.map((tab) => {
                  const isActive = isShellTabActive(tab);
                  if (tab.path === ROUTES.CATEGORIES) {
                    return (
                      <CategoriesNavTab
                        key={tab.id}
                        authenticated={false}
                        tabLabel={getTabLabel(tab.labelKey)}
                        isActive={isActive}
                      />
                    );
                  }
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`roomTab roomTabLocked ${isActive ? "roomTabActive" : ""}`}
                      onClick={() => navigate(ROUTES.LOGIN, { state: { from: tab.path } })}
                      title={t("loginRequired")}
                    >
                      🔒 {getTabLabel(tab.labelKey)}
                    </button>
                  );
                })}
          </nav>
        </div>
      </div>

      {isFocusModalOpen && (
        <Modal
          variant="timer"
          onClose={() => {
            setIsFocusModalOpen(false);
            setPickDurationOpen(false);
          }}
        >
          <div className="focusTimerWrap" dir={isRtl ? "rtl" : "ltr"} style={{ display: "grid", gap: 16 }}>
            <div
              className="focusTimerClock"
              style={{ fontSize: "2.5rem", fontWeight: 800, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            >
              {formatTimer(displayedSeconds)}
            </div>
            {totalSeconds > 0 || isTimerRunning ? (
              <div
                className="focusTimerProgress"
                style={{ height: 6, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}
              >
                <div
                  className="focusTimerProgressBar"
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "var(--accent)",
                    transition: "width 0.3s linear",
                  }}
                />
              </div>
            ) : null}

            <div className="focusTimerActions" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              <button type="button" className="wow-btn wow-btnPrimary" onClick={onStartClick} disabled={isTimerRunning}>
                {t("startTimer")}
              </button>
              <button type="button" className="wow-btn" onClick={resetFocusTimer}>
                {t("reset")}
              </button>
            </div>

            {pickDurationOpen && !isTimerRunning ? (
              <div className="focusTimerPresets" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {FOCUS_PRESETS.map((mins) => (
                  <button key={mins} type="button" className="wow-btn" onClick={() => startTimerWithPresetMinutes(mins)}>
                    {t("timerMinutes", { mins })}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Modal>
      )}

      <div className="app-container">
        <Outlet />
      </div>

      <footer className="appFooter" dir={isRtl ? "rtl" : "ltr"} aria-label={t("footerAria")} />
    </div>
  );
}
