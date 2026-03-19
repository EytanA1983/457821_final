import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TaskList from "../components/TaskList";
import WeeklyCalendarStrip from "../components/WeeklyCalendarStrip";
import BeforeAfterTimeline from "../components/BeforeAfterTimeline";
import { Task } from "../app/types";
import api, { fetchMe, getDailyReset, getProgressSummary } from '../api.ts';
import { clearTokens, hasTokens } from '../utils/tokenStorage';
import { ROUTES } from '../utils/routes';
import { showError } from '../utils/toast';
import { DailyFocusRead, DailyFocusCompleteIn, DailyFocusRefreshIn } from '../schemas/daily_focus';
import type { ProgressSummaryRead } from '../schemas/progress';

type RecommendedVideo = {
  videoId: string | null;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
};

type DashboardRoom = {
  id: string;
  nameHe: string;
  nameEn: string;
  emoji: string;
};

type RoomCoachItem = {
  task: string;
  tip: string;
  example: string;
};

type RoomCoachLocalizedItem = {
  task: { he: string; en: string };
  tip: { he: string; en: string };
  example: { he: string; en: string };
};

const extractYouTubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/
  );
  return match?.[1] ?? null;
};

const ROOM_PLAYBOOK: Record<string, RoomCoachLocalizedItem[]> = {
  kitchen: [
    {
      task: { he: "התחילי מהמגירה העליונה", en: "Start with the top drawer" },
      tip: { he: "עבדי רק מגירה אחת בכל סשן", en: "Focus on just one drawer this session" },
      example: { he: "זרקי 3 פריטים שלא השתמשת בהם שנה", en: "Discard 3 items you have not used in a year" },
    },
    {
      task: { he: "סדרי את המזווה", en: "Organize the pantry" },
      tip: { he: "קבצי לפי קטגוריות (פסטה/קטניות/שימורים)", en: "Group by category (pasta/legumes/canned food)" },
      example: { he: "הוציאי מוצרים כפולים שלא צריך", en: "Remove duplicate products you do not need" },
    },
    {
      task: { he: "בדקי תוקף במקרר", en: "Check fridge expiration dates" },
      tip: { he: "מה שפג תוקף יוצא מיד", en: "Anything expired goes out immediately" },
      example: { he: "זרקי 3 מוצרים ישנים מהמקרר", en: "Throw out 3 old products from the fridge" },
    },
  ],
  bedroom: [
    {
      task: { he: "קפלי 10 חולצות", en: "Fold 10 shirts" },
      tip: { he: "סדרי לפי צבעים כדי לשמור על רצף", en: "Sort by color to keep a simple flow" },
      example: { he: "הוציאי בגדים שלא לבשת שנה", en: "Remove clothes you have not worn in a year" },
    },
    {
      task: { he: "סדרי את שידת הלילה", en: "Organize the nightstand" },
      tip: { he: "השאירי רק מה שאת משתמשת בו ביום-יום", en: "Keep only what you use daily" },
      example: { he: "פני 5 פריטים מיותרים מהמגירה", en: "Clear 5 unnecessary items from the drawer" },
    },
    {
      task: { he: "עשי סבב ארון קצר", en: "Do a quick closet round" },
      tip: { he: "בחרי מדף אחד בלבד", en: "Choose only one shelf" },
      example: { he: "תרמי 3 פריטים שכבר לא משרתים אותך", en: "Donate 3 items that no longer serve you" },
    },
  ],
  "living-room": [
    {
      task: { he: "פני את השולחן המרכזי", en: "Clear the center table" },
      tip: { he: "כל פריט חוזר למקום הקבוע שלו", en: "Return each item to its fixed place" },
      example: { he: "אחסני 5 פריטים שהתפזרו בסלון", en: "Put away 5 items scattered in the living room" },
    },
    {
      task: { he: "סדרי מגירת שלטונים", en: "Organize the remote-control drawer" },
      tip: { he: "השאירי רק מה שבשימוש אמיתי", en: "Keep only what is actually in use" },
      example: { he: "הוציאי סוללות/כבלים לא נחוצים", en: "Remove unnecessary batteries/cables" },
    },
    {
      task: { he: "נקי משטח אחד", en: "Clean one surface" },
      tip: { he: "משטח נקי מייצר תחושת שליטה מיידית", en: "A clean surface creates instant control" },
      example: { he: "נקי מדף אחד ליד הטלוויזיה", en: "Clean one shelf near the TV" },
    },
  ],
  closet: [
    {
      task: { he: "קפלי ערימה אחת", en: "Fold one pile" },
      tip: { he: "אל תפתחי הכל — רק אזור אחד", en: "Do not open everything, just one area" },
      example: { he: "העבירי 3 פריטים לשק תרומה", en: "Move 3 items to a donation bag" },
    },
    {
      task: { he: "סדרי לפי קטגוריות", en: "Sort by categories" },
      tip: { he: "חולצות בנפרד, מכנסיים בנפרד", en: "Shirts separately, pants separately" },
      example: { he: "בחרי מדף אחד וסיימי אותו", en: "Pick one shelf and finish it" },
    },
    {
      task: { he: "סינון מהיר", en: "Quick declutter" },
      tip: { he: "כל מה שלא נלבש שנה — החוצה", en: "Anything not worn in a year goes out" },
      example: { he: "הוציאי 5 פריטים לא רלוונטיים", en: "Remove 5 irrelevant items" },
    },
  ],
  bathroom: [
    {
      task: { he: "סדרי מגירת תמרוקים", en: "Organize the toiletries drawer" },
      tip: { he: "מוצרים יומיומיים קדימה", en: "Move daily products to the front" },
      example: { he: "השליכי 3 מוצרים שפג תוקפם", en: "Discard 3 expired products" },
    },
    {
      task: { he: "נקי את משטח הכיור", en: "Clean the sink surface" },
      tip: { he: "שמרי רק את מה שבשימוש יומי", en: "Keep only daily-use items" },
      example: { he: "העבירי פריטים מיותרים לאחסון", en: "Move extra items to storage" },
    },
    {
      task: { he: "ארגני מגבות", en: "Organize towels" },
      tip: { he: "קיפול אחיד נותן סדר מהיר לעין", en: "Uniform folding creates instant visual order" },
      example: { he: "קפלי וסדרי 6 מגבות", en: "Fold and arrange 6 towels" },
    },
  ],
};

const DEFAULT_COACH: RoomCoachLocalizedItem = {
  task: { he: "בחרי אזור קטן להתחלה", en: "Choose one small area to start" },
  tip: { he: "5 דקות של פוקוס עדיפות על דחיינות", en: "5 focused minutes beat procrastination" },
  example: { he: "סדרי מדף אחד וסיימי", en: "Organize one shelf and finish it" },
};

const triggerProgressRefresh = () => {
  // Stage 2 hook: consumers can listen to this event and refresh progress widgets.
  window.dispatchEvent(new CustomEvent("daily-focus:completed"));
};

const DEMO_TASK_TITLES: Record<string, { he: string; en: string }> = {
  "1": { he: "שאיבת אבק בסלון", en: "Vacuum the living room" },
  "2": { he: "ניקוי משטחים", en: "Wipe surfaces" },
  "3": { he: "הכנת ארוחת בוקר", en: "Prepare breakfast" },
  "4": { he: "שטיפת כלים", en: "Wash dishes" },
  "5": { he: "ניקוי מקרר", en: "Clean the refrigerator" },
  "6": { he: "כביסה לבנה", en: "White laundry" },
  "7": { he: "קיפול כביסה", en: "Fold laundry" },
  "8": { he: "ניקוי חדר אמבטיה", en: "Clean the bathroom" },
  "9": { he: "החלפת מגבות", en: "Replace towels" },
  "10": { he: "החלפת מצעים", en: "Change bed sheets" },
  "11": { he: "סידור ארון", en: "Organize wardrobe" },
};

const localizeDemoTaskTitles = (inputTasks: Task[], isEnglish: boolean): Task[] => {
  return inputTasks.map((task) => {
    const key = String(task.id);
    const labels = DEMO_TASK_TITLES[key];
    if (!labels) return task;

    // Only replace known demo titles to avoid touching user-created tasks.
    const isKnownDemoTitle = task.title === labels.he || task.title === labels.en;
    if (!isKnownDemoTitle) return task;

    return {
      ...task,
      title: isEnglish ? labels.en : labels.he,
    };
  });
};

const buildInitialDemoTasks = (isEnglish: boolean): Task[] => {
  const initialTasks: Task[] = [
    {
      id: "1",
      title: DEMO_TASK_TITLES["1"].he,
      room: "living-room",
      completed: false,
      frequency: "daily",
      scheduledTime: "09:00",
    },
    {
      id: "2",
      title: DEMO_TASK_TITLES["2"].he,
      room: "living-room",
      completed: false,
      frequency: "daily",
      scheduledTime: "10:00",
    },
    {
      id: "3",
      title: DEMO_TASK_TITLES["3"].he,
      room: "kitchen",
      completed: false,
      frequency: "daily",
      scheduledTime: "08:00",
    },
    {
      id: "4",
      title: DEMO_TASK_TITLES["4"].he,
      room: "kitchen",
      completed: true,
      frequency: "daily",
      scheduledTime: "20:00",
    },
    {
      id: "5",
      title: DEMO_TASK_TITLES["5"].he,
      room: "kitchen",
      completed: false,
      frequency: "weekly",
      scheduledTime: "14:00",
    },
    {
      id: "6",
      title: DEMO_TASK_TITLES["6"].he,
      room: "bathroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "11:00",
    },
    {
      id: "7",
      title: DEMO_TASK_TITLES["7"].he,
      room: "bathroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "15:00",
    },
    {
      id: "8",
      title: DEMO_TASK_TITLES["8"].he,
      room: "bathroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "16:00",
    },
    {
      id: "9",
      title: DEMO_TASK_TITLES["9"].he,
      room: "bathroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "17:00",
    },
    {
      id: "10",
      title: DEMO_TASK_TITLES["10"].he,
      room: "bedroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "10:00",
    },
    {
      id: "11",
      title: DEMO_TASK_TITLES["11"].he,
      room: "bedroom",
      completed: false,
      frequency: "weekly",
      scheduledTime: "11:00",
    },
  ];

  return localizeDemoTaskTitles(initialTasks, isEnglish);
};

export default function Dashboard() {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        loading: "Loading...",
        heroTitle: "Your home, your calm",
        heroSub: "Just 5 minutes a day to bring calm back home.",
        heroCta: "✨ Start a small task",
        dailyTaskTitle: "✨ Task of the day",
        start5: "Start 5-Minute Reset",
        done: "Done",
        noOpenTasks: "No open tasks",
        completeTask: "Done",
        createFirstTask: "Create first task",
        weeklyProgress: "Weekly progress",
        tasksLabel: "Tasks",
        roomsLabel: "Rooms",
        streakLabel: "Streak days",
        trendCaption: "Last 7 days (tasks completed)",
        weekBoard: "Week board",
        yourDaySub: "Quick view of calendar and upcoming tasks.",
        tasksByRoom: "Tasks by Room",
        aiCoach: "AI Coach",
        relevantVideo: "📺 Relevant video",
        resetTitle: "5-Minute Reset",
        resetFocusLine: "One focused stretch. You’ve got this.",
        pause: "Pause",
        resume: "Resume",
        cancelSession: "Cancel",
        completeEarly: "Finish early",
        completeSaveError: "Could not save completion. Check your connection.",
        refreshAfterSaveError: "Saved, but could not load the next task. Pull to refresh or try again from the card.",
        retrySave: "Try again",
        timerMvpNote: "Tip: refreshing the page will reset the timer (MVP).",
        close: "Close",
        greatJob: "Great job!",
        challengeSuccessMotivation: "Small wins add up. One calm step at a time.",
        challengeStatStreak: "{{n}}-day streak",
        challengeStatWeek: "{{n}} tasks completed this week",
        nextTaskCta: "Next task",
        backDashboardCta: "Back to dashboard",
        dailyTaskFallback: "Daily task",
        allDay: "All day",
        refresh: "Refresh",
        refreshing: "Refreshing...",
      }
    : {
        loading: "טוען...",
        heroTitle: "הבית שלך, השקט שלך",
        heroSub: "רק 5 דקות ביום כדי להחזיר שליטה לבית.",
        heroCta: "✨ התחילי משימה קטנה",
        dailyTaskTitle: "✨ משימת היום",
        start5: "התחל איפוס 5 דקות",
        done: "סיימתי",
        noOpenTasks: "אין משימות פתוחות",
        allDay: "כל היום",
        completeTask: "סיימתי",
        createFirstTask: "יצירת משימה ראשונה",
        refresh: "החליפי משימה",
        refreshing: "מחליפה...",
        weeklyProgress: "התקדמות השבוע",
        tasksLabel: "משימות",
        roomsLabel: "חדרים",
        streakLabel: "ימים רצופים",
        trendCaption: "7 ימים אחרונים (משימות שהושלמו)",
        weekBoard: "לוח השבוע",
        yourDaySub: "מבט מהיר ליומן ולמשימות הקרובות.",
        tasksByRoom: "משימות לפי חדר",
        aiCoach: "AI Coach",
        relevantVideo: "📺 סרטון רלוונטי",
        resetTitle: "איפוס 5 דקות",
        resetFocusLine: "ריכוז קצר. את בטוח מצליחה.",
        pause: "השהה",
        resume: "המשיכי",
        cancelSession: "ביטול",
        completeEarly: "סיימתי מוקדם",
        completeSaveError: "לא ניתן לשמור את הסיום. בדקי חיבור.",
        refreshAfterSaveError: "נשמר, אבל לא נטענה משימה חדשה. רענני את המסך או נסי שוב מהכרטיס.",
        retrySave: "נסי שוב",
        timerMvpNote: "שימי לב: רענון עמוד מאפס את הטיימר (גרסת MVP).",
        close: "סגירה",
        greatJob: "כל הכבוד!",
        challengeSuccessMotivation: "ניצחונות קטנים מצטברים. צעד רגוע אחר צעד.",
        challengeStatStreak: "רצף של {{n}} ימים",
        challengeStatWeek: "{{n}} משימות שהושלמו השבוע",
        nextTaskCta: "למשימה הבאה",
        backDashboardCta: "חזרה לדשבורד",
        dailyTaskFallback: "משימה יומית",
      };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<string>("living-room");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendedVideo, setRecommendedVideo] = useState<RecommendedVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoTaskContextId, setVideoTaskContextId] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetDone, setIsResetDone] = useState(false);
  /** Paused = interval stopped; timer seconds frozen in state. */
  const [isResetPaused, setIsResetPaused] = useState(false);
  const [completeSaveFailed, setCompleteSaveFailed] = useState(false);

  /** Bound when challenge opens — survives daily refetch; used for POST /daily-reset/complete. */
  const resetSessionTaskIdRef = useRef<number | null>(null);
  const resetSessionTitleRef = useRef("");
  const resetSessionRoomRef = useRef("");

  // Daily Reset API
  const { data: dailyFocus, isLoading: dailyFocusLoading } = useQuery<DailyFocusRead>({
    queryKey: ["daily-reset", "today"],
    queryFn: async () => {
      const response = await getDailyReset();
      return response.data;
    },
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const completeMutation = useMutation({
    mutationFn: async (payload: DailyFocusCompleteIn) => {
      const response = await api.post<DailyFocusRead>("/daily-reset/complete", payload);
      return response.data;
    },
    onSuccess: (data) => {
      // Apply server truth immediately (avoids stale card until refetch; respects 5m staleTime).
      queryClient.setQueryData<DailyFocusRead>(["daily-reset", "today"], data);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      triggerProgressRefresh();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (payload: DailyFocusRefreshIn) => {
      const response = await api.post<DailyFocusRead>("/daily-reset/refresh", payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DailyFocusRead>(["daily-reset", "today"], data);
    },
  });

  const {
    data: progressSummary,
    isLoading: progressLoading,
    isError: progressError,
  } = useQuery<ProgressSummaryRead>({
    queryKey: ["progress", "summary", "week"],
    queryFn: async () => {
      const res = await getProgressSummary("week");
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onProgressHook = () => {
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    };
    window.addEventListener("daily-focus:completed", onProgressHook);
    return () => window.removeEventListener("daily-focus:completed", onProgressHook);
  }, [queryClient]);

  const rooms: DashboardRoom[] = [
    { id: "living-room", nameHe: "סלון", nameEn: "Living Room", emoji: "🏠" },
    { id: "kitchen", nameHe: "מטבח", nameEn: "Kitchen", emoji: "🍳" },
    { id: "bedroom", nameHe: "חדר שינה", nameEn: "Bedroom", emoji: "🛏" },
    { id: "closet", nameHe: "ארון", nameEn: "Closet", emoji: "👕" },
  ];

  useEffect(() => {
    const loadUser = async () => {
      // Check if user has tokens
      if (!hasTokens()) {
        console.log('[Dashboard] No tokens found, redirecting to login');
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }

      try {
        // Fetch user info from API
        await fetchMe();
      } catch (error) {
        console.error('[Dashboard] Error fetching user:', error);
        // If token is invalid, clear and redirect
        clearTokens();
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }

      // Load tasks from localStorage or create demo tasks
      const savedTasks = localStorage.getItem("tasks");
      if (savedTasks) {
        try {
          const parsedTasks = JSON.parse(savedTasks) as Task[];
          const localizedTasks = localizeDemoTaskTitles(parsedTasks, isEnglish);
          setTasks(localizedTasks);
          localStorage.setItem("tasks", JSON.stringify(localizedTasks));
        } catch (e) {
          console.error('[Dashboard] Error parsing saved tasks:', e);
        }
      } else {
        const initialTasks = buildInitialDemoTasks(isEnglish);
        setTasks(initialTasks);
        localStorage.setItem("tasks", JSON.stringify(initialTasks));
      }

      setLoading(false);
    };

    loadUser();
  }, [isEnglish, navigate]);

  const toggleTask = async (taskId: number | string) => {
    const taskIdStr = String(taskId);
    const currentTask = tasks.find((task) => String(task.id) === taskIdStr);
    if (!currentTask) return;
    const nextCompleted = !currentTask.completed;

    const optimisticTasks = tasks.map((task) =>
      String(task.id) === taskIdStr ? { ...task, completed: nextCompleted } : task
    );
    setTasks(optimisticTasks);
    localStorage.setItem("tasks", JSON.stringify(optimisticTasks));

    const numericId = Number(taskIdStr);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return;
    }

    try {
      await api.patch(`/tasks/${numericId}`, { completed: nextCompleted });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    } catch {
      // Revert optimistic update when backend update fails.
      const revertedTasks = tasks.map((task) =>
        String(task.id) === taskIdStr ? { ...task, completed: currentTask.completed } : task
      );
      setTasks(revertedTasks);
      localStorage.setItem("tasks", JSON.stringify(revertedTasks));
    }
  };

  const filteredTasks = tasks.filter((task) => task.room === selectedRoom);
  const contextTask = videoTaskContextId ? tasks.find((task) => String(task.id) === videoTaskContextId) : undefined;
  const roomForVideo = contextTask?.room || selectedRoom;
  useEffect(() => {
    if (!roomForVideo) return;
    let isMounted = true;
    setVideoLoading(true);

    api.get<RecommendedVideo>("/content/recommended-video", {
      params: { room_id: roomForVideo, lang: isEnglish ? "en" : "he" },
    })
      .then(({ data }) => {
        if (!isMounted) return;
        setRecommendedVideo(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setRecommendedVideo(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setVideoLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomForVideo, isEnglish]);

  useEffect(() => {
    setVideoTaskContextId(null);
  }, [selectedRoom]);

  // Get daily task from API
  const dailyTask = dailyFocus?.task || null;
  const completedTasksCount =
    progressLoading ? null : progressError ? 0 : (progressSummary?.completed_tasks_this_week ?? 0);
  const organizedRoomsCount =
    progressLoading ? null : progressError ? 0 : (progressSummary?.rooms_progressed_this_week ?? 0);
  const streakDays = progressLoading ? null : progressError ? 0 : (progressSummary?.streak_days ?? 0);
  const trendMax = useMemo(() => {
    const arr = progressSummary?.daily_completed_counts ?? [];
    if (!arr.length) return 1;
    return Math.max(1, ...arr.map((d) => d.count));
  }, [progressSummary]);
  const dailyTaskTime = dailyTask?.due_date
    ? new Date(dailyTask.due_date).toLocaleTimeString(isEnglish ? "en-US" : "he-IL", { hour: "2-digit", minute: "2-digit" })
    : text.allDay;
  const secondsForClock = isResetDone ? 0 : timer ?? 0;
  const timerLabel = `${String(Math.floor(secondsForClock / 60)).padStart(2, "0")}:${String(
    secondsForClock % 60
  ).padStart(2, "0")}`;
  const embeddedVideoId = recommendedVideo?.videoId || extractYouTubeId(recommendedVideo?.url) || "dQw4w9WgXcQ";
  const embeddedVideoUrl = `https://www.youtube.com/embed/${embeddedVideoId}`;
  
  // Get room info from daily task
  const dailyRoomId = dailyTask?.room_id;
  const dailyRoom = dailyRoomId ? rooms.find((r) => r.id === String(dailyRoomId)) : null;
  const dailyRoomLabel = dailyRoom ? (isEnglish ? dailyRoom.nameEn : dailyRoom.nameHe) : "";
  const dailyRoomEmoji = dailyRoom?.emoji || "🏡";
  const roomTasks = tasks.filter((task) => task.room === selectedRoom);
  const completedInRoom = roomTasks.filter((task) => task.completed).length;
  const coachCandidates = ROOM_PLAYBOOK[selectedRoom] || [DEFAULT_COACH];
  const coachIndex = coachCandidates.length
    ? (new Date().getDate() + completedInRoom) % coachCandidates.length
    : 0;
  const coachRecommendationRaw = coachCandidates[coachIndex] || DEFAULT_COACH;
  const coachRecommendation: RoomCoachItem = {
    task: isEnglish ? coachRecommendationRaw.task.en : coachRecommendationRaw.task.he,
    tip: isEnglish ? coachRecommendationRaw.tip.en : coachRecommendationRaw.tip.he,
    example: isEnglish ? coachRecommendationRaw.example.en : coachRecommendationRaw.example.he,
  };

  const startTimer = () => {
    if (!dailyTask || !dailyFocus) return;
    const tid =
      dailyFocus.task_id ??
      (typeof dailyTask.id === "number" ? dailyTask.id : Number(dailyTask.id));
    resetSessionTaskIdRef.current = Number.isFinite(tid) ? tid : dailyFocus.task_id ?? null;
    resetSessionTitleRef.current = dailyTask.title;
    resetSessionRoomRef.current = dailyRoomLabel ? `${dailyRoomEmoji} ${dailyRoomLabel}` : "";
    setCompleteSaveFailed(false);
    setIsResetPaused(false);
    setIsResetOpen(true);
    setIsResetDone(false);
    setTimer(300);
  };

  useEffect(() => {
    if (!isResetOpen || isResetPaused || isResetDone) return;
    const id = window.setInterval(() => {
      setTimer((prev) => {
        if (prev === null || prev < 1) return prev;
        if (prev <= 1) {
          setIsResetDone(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isResetOpen, isResetPaused, isResetDone]);

  const cancelResetSession = () => {
    resetSessionTaskIdRef.current = null;
    setIsResetOpen(false);
    setIsResetDone(false);
    setIsResetPaused(false);
    setTimer(null);
    setCompleteSaveFailed(false);
  };

  const markChallengeFinishedEarly = () => {
    setIsResetPaused(true);
    setTimer(null);
    setIsResetDone(true);
  };

  /** POST /daily-reset/complete — does not close modal (completion UX stays until user chooses next step). */
  const saveChallengeCompletionOnly = async (): Promise<boolean> => {
    const taskId = resetSessionTaskIdRef.current ?? dailyFocus?.task_id ?? undefined;
    if (taskId == null && dailyFocus?.task_id == null) return false;
    setCompleteSaveFailed(false);
    try {
      await completeMutation.mutateAsync({
        task_id: taskId ?? dailyFocus?.task_id ?? undefined,
      });
      setCompleteSaveFailed(false);
      return true;
    } catch {
      setCompleteSaveFailed(true);
      showError(text.completeSaveError);
      return false;
    }
  };

  const closeChallengeModalClean = () => {
    resetSessionTaskIdRef.current = null;
    setIsResetOpen(false);
    setIsResetDone(false);
    setIsResetPaused(false);
    setTimer(null);
    setCompleteSaveFailed(false);
  };

  /** Save, refresh daily reset for a new task, close (habit momentum). */
  const finishChallengeNextTask = async () => {
    if (completeMutation.isPending || refreshMutation.isPending) return;
    const ok = await saveChallengeCompletionOnly();
    if (!ok) return;
    try {
      await refreshMutation.mutateAsync({});
    } catch {
      showError(text.refreshAfterSaveError);
    } finally {
      closeChallengeModalClean();
    }
  };

  /** Save and return to dashboard (no refresh of focus). */
  const finishChallengeBackToDashboard = async () => {
    if (completeMutation.isPending || refreshMutation.isPending) return;
    const ok = await saveChallengeCompletionOnly();
    if (!ok) return;
    closeChallengeModalClean();
  };

  /** Card "Done" without opening challenge — uses current API focus only. */
  const completeDailyTaskFromCard = async () => {
    if (!dailyFocus) return;
    try {
      await completeMutation.mutateAsync({
        task_id: dailyFocus.task_id || undefined,
      });
    } catch {
      showError(text.completeSaveError);
    }
  };

  const refreshDailyTask = async () => {
    const payload: DailyFocusRefreshIn = {};
    await refreshMutation.mutateAsync(payload);
  };

  const startSmallTask = () => {
    if (dailyTask && !dailyFocus?.completed_at) {
      startTimer();
      return;
    }
    navigate(ROUTES.ADD_TASK);
  };

  const challengeStatLine = useMemo(() => {
    if (streakDays != null && streakDays > 0) {
      return text.challengeStatStreak.replace(/\{\{n\}\}/g, String(streakDays));
    }
    if (progressSummary != null && !progressLoading && !progressError) {
      return text.challengeStatWeek.replace(
        /\{\{n\}\}/g,
        String(progressSummary.completed_tasks_this_week ?? 0),
      );
    }
    return null;
  }, [
    streakDays,
    progressSummary,
    progressLoading,
    progressError,
    text.challengeStatStreak,
    text.challengeStatWeek,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{text.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }} dir={isEnglish ? "ltr" : "rtl"}>
      <div className="hero">
        <div className="hero-content">
          <h1>
            {text.heroTitle}
          </h1>

          <p>
            {text.heroSub}
          </p>

          <button type="button" className="hero-btn" onClick={startSmallTask}>
            {text.heroCta}
          </button>
        </div>
      </div>

      <div className="daily-card">
        <h2>{text.dailyTaskTitle}</h2>
        {dailyFocusLoading ? (
          <p className="task-title">{text.loading}</p>
        ) : dailyTask ? (
          <>
            {dailyRoomLabel && (
              <div className="daily-line">{dailyRoomEmoji} {dailyRoomLabel}</div>
            )}
            <p className="task-title">{dailyTask.title}</p>
            {dailyTask.due_date && (
              <div className="wow-muted">{dailyTaskTime}</div>
            )}
            {dailyFocus?.completed_at && (
              <div className="wow-muted" style={{ color: "#10b981" }}>
                ✓ {isEnglish ? "Completed" : "הושלם"}
              </div>
            )}
          </>
        ) : (
          <p className="task-title">{text.noOpenTasks}</p>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={startTimer}
            disabled={!dailyTask || isResetOpen || !!dailyFocus?.completed_at}
          >
            {text.start5}
          </button>

          <button 
            type="button" 
            className="secondary" 
            onClick={completeDailyTaskFromCard}
            disabled={!dailyTask || completeMutation.isPending || !!dailyFocus?.completed_at}
          >
            {completeMutation.isPending ? text.loading : text.done}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={refreshDailyTask}
            disabled={!dailyTask || refreshMutation.isPending || !!dailyFocus?.completed_at}
            title={isEnglish ? "Get a different task" : "קבלי משימה אחרת"}
          >
            {refreshMutation.isPending ? text.refreshing : text.refresh}
          </button>
        </div>

        {!dailyTask && !dailyFocusLoading && (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="wow-btn wow-btnPrimary" onClick={() => navigate(ROUTES.ADD_TASK)}>
              {text.createFirstTask}
            </button>
          </div>
        )}
      </div>

      <div className="progress-card">
        <h3>{text.weeklyProgress}</h3>

        <div className="stats">
          <div className="stat">
            {progressLoading ? "—" : completedTasksCount}
            <span>{text.tasksLabel}</span>
          </div>

          <div className="stat">
            {progressLoading ? "—" : organizedRoomsCount}
            <span>{text.roomsLabel}</span>
          </div>

          <div className="stat">
            {progressLoading ? "—" : <>🔥 {streakDays}</>}
            <span>{text.streakLabel}</span>
          </div>
        </div>

        {!progressLoading && progressSummary && (
          <>
            <div className="lifestyle-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {text.trendCaption}
            </div>
            <div
              className="progress-trend"
              role="img"
              aria-label={isEnglish ? "Completed tasks per day, last 7 days" : "משימות שהושלמו לפי יום, 7 ימים"}
            >
              {progressSummary.daily_completed_counts.map((d) => {
                const dayNum = Number(d.date.slice(8, 10)) || 0;
                const h = Math.max(4, Math.round((d.count / trendMax) * 44));
                return (
                  <div key={d.date} className="progress-trend-bar-wrap" title={`${d.date}: ${d.count}`}>
                    <div className="progress-trend-bar" style={{ height: h }} />
                    <span className="progress-trend-dow">{dayNum}</span>
                  </div>
                );
              })}
            </div>
            {!progressError &&
              (progressSummary.completed_tasks_this_week ?? 0) === 0 &&
              (progressSummary.streak_days ?? 0) === 0 && (
                <p className="lifestyle-muted" style={{ fontSize: 13, margin: 0 }}>
                  {isEnglish
                    ? "Complete a task to start your week and streak — small steps count."
                    : "השלימי משימה כדי להתחיל את השבוע והרצף — גם צעדים קטנים נספרים."}
                </p>
              )}
          </>
        )}
      </div>

      <div className="lifestyle-card journal-card">
        <div className="lifestyle-title">
          {text.weekBoard}
        </div>
        <div className="lifestyle-muted journal-subtitle" style={{ marginBottom: 12 }}>
          {text.yourDaySub}
        </div>
        <WeeklyCalendarStrip
          tasks={tasks}
          onToggleComplete={toggleTask}
          onTaskSelect={(taskId) => setVideoTaskContextId(String(taskId))}
        />
      </div>

      <div className="lifestyle-card">
        <div className="lifestyle-title">
          {text.tasksByRoom}
        </div>

        <div className="rooms-grid" style={{ marginTop: 16 }}>
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`room-grid-card ${selectedRoom === room.id ? "room-grid-card--active" : ""}`}
              onClick={() => setSelectedRoom(room.id)}
            >
              <span className="room-grid-emoji">{room.emoji}</span>
              <span className="room-grid-name">{isEnglish ? room.nameEn : room.nameHe}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <TaskList
            tasks={filteredTasks}
            onTaskToggle={toggleTask}
          />
        </div>
      </div>

      <div className="lifestyle-card inspiration-card">
        <div className="lifestyle-title">{text.aiCoach}</div>
        <div className="coach-task">{coachRecommendation.task}</div>
        <div className="wow-muted">{coachRecommendation.tip}</div>
        <div className="coach-example">{coachRecommendation.example}</div>
        <div className="lifestyle-title" style={{ fontSize: 18, marginTop: 8 }}>{text.relevantVideo}</div>
        {videoLoading ? (
          <div className="wow-skeleton" style={{ height: 180, borderRadius: 12 }} />
        ) : (
          <iframe
            title="Eli quick tip"
            src={embeddedVideoUrl}
            className="inspiration-embed"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
      </div>

      <BeforeAfterTimeline />

      {isResetOpen && (
        <div className="reset-overlay reset-overlay--challenge" role="dialog" aria-modal="true" aria-labelledby="reset-challenge-title">
          <div
            className={`reset-modal reset-modal--challenge${isResetDone ? " reset-modal--completion" : ""}`}
          >
            {!isResetDone ? (
              <>
                <div id="reset-challenge-title" className="reset-title">
                  {text.resetTitle}
                </div>
                <p className="reset-focus-line">{text.resetFocusLine}</p>
                {resetSessionRoomRef.current ? (
                  <div className="reset-room-line">{resetSessionRoomRef.current}</div>
                ) : null}
                <div className="reset-task-title">{resetSessionTitleRef.current}</div>
                <div className="reset-clock" aria-live="polite" aria-atomic="true">
                  {timerLabel}
                </div>
                <p className="reset-mvp-note">{text.timerMvpNote}</p>
                <div className="reset-challenge-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setIsResetPaused((p) => !p)}
                  >
                    {isResetPaused ? text.resume : text.pause}
                  </button>
                  <button type="button" className="secondary" onClick={markChallengeFinishedEarly}>
                    {text.completeEarly}
                  </button>
                  <button type="button" className="secondary reset-btn-danger" onClick={cancelResetSession}>
                    {text.cancelSession}
                  </button>
                </div>
              </>
            ) : (
              <div className="reset-completion">
                <div className="reset-success-visual" aria-hidden="true">
                  <span className="reset-success-check">✓</span>
                </div>
                <h2 className="reset-completion-title">{text.greatJob}</h2>
                <p className="reset-completion-motivation">{text.challengeSuccessMotivation}</p>
                {resetSessionRoomRef.current ? (
                  <div className="reset-room-line reset-completion-room">{resetSessionRoomRef.current}</div>
                ) : null}
                <div className="reset-task-title reset-completion-task">
                  {resetSessionTitleRef.current || text.dailyTaskFallback}
                </div>
                {challengeStatLine ? <div className="reset-stat-pill">{challengeStatLine}</div> : null}
                {completeSaveFailed ? (
                  <>
                    <p className="reset-save-error" role="alert">
                      {text.completeSaveError}
                    </p>
                    <div className="reset-completion-actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => void saveChallengeCompletionOnly()}
                        disabled={completeMutation.isPending}
                      >
                        {completeMutation.isPending ? text.loading : text.retrySave}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="reset-completion-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => void finishChallengeNextTask()}
                      disabled={completeMutation.isPending || refreshMutation.isPending}
                    >
                      {completeMutation.isPending || refreshMutation.isPending ? text.loading : text.nextTaskCta}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void finishChallengeBackToDashboard()}
                      disabled={completeMutation.isPending || refreshMutation.isPending}
                    >
                      {text.backDashboardCta}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
