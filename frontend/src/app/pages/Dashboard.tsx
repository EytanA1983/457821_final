import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RoomSelector from "../components/RoomSelector";
import TaskList from "../components/TaskList";
import HomeProgress from "../components/HomeProgress";
import WeeklyCalendarStrip from "../../components/WeeklyCalendarStrip";
import { Task } from "../types";
import api, { fetchMe } from '../../api.ts';
import { clearTokens, hasTokens } from '../../utils/tokenStorage';
import { ROUTES } from '../../utils/routes';

type RecommendedVideo = {
  videoId: string | null;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState<string>("living-room");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendedVideo, setRecommendedVideo] = useState<RecommendedVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/sounds/notify.mp3");
      audio.volume = 0.8;
      void audio.play();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if ("Notification" in window) {
      void Notification.requestPermission();
    }
  }, []);

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
          setTasks(JSON.parse(savedTasks));
        } catch (e) {
          console.error('[Dashboard] Error parsing saved tasks:', e);
        }
      } else {
        // Demo tasks for initial setup
        const initialTasks: Task[] = [
          {
            id: "1",
            title: "שאיבת אבק בסלון",
            room: "living-room",
            completed: false,
            frequency: "daily",
            scheduledTime: "09:00",
          },
          {
            id: "2",
            title: "ניקוי משטחים",
            room: "living-room",
            completed: false,
            frequency: "daily",
            scheduledTime: "10:00",
          },
          {
            id: "3",
            title: "הכנת ארוחת בוקר",
            room: "kitchen",
            completed: false,
            frequency: "daily",
            scheduledTime: "08:00",
          },
          {
            id: "4",
            title: "שטיפת כלים",
            room: "kitchen",
            completed: true,
            frequency: "daily",
            scheduledTime: "20:00",
          },
          {
            id: "5",
            title: "ניקוי מקרר",
            room: "kitchen",
            completed: false,
            frequency: "weekly",
            scheduledTime: "14:00",
          },
          {
            id: "6",
            title: "כביסה לבנה",
            room: "bathroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "11:00",
          },
          {
            id: "7",
            title: "קיפול כביסה",
            room: "bathroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "15:00",
          },
          {
            id: "8",
            title: "ניקוי חדר אמבטיה",
            room: "bathroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "16:00",
          },
          {
            id: "9",
            title: "החלפת מגבות",
            room: "bathroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "17:00",
          },
          {
            id: "10",
            title: "החלפת מצעים",
            room: "bedroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "10:00",
          },
          {
            id: "11",
            title: "סידור ארון",
            room: "bedroom",
            completed: false,
            frequency: "weekly",
            scheduledTime: "11:00",
          },
        ];
        setTasks(initialTasks);
        localStorage.setItem("tasks", JSON.stringify(initialTasks));
      }

      setLoading(false);
    };

    loadUser();
  }, [navigate]);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const hhmm = now.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      });

      tasks.forEach((task) => {
        if (!task.completed && task.scheduledTime === hhmm) {
          playNotificationSound();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("תזכורת מהבית של אלי", {
              body: task.title,
            });
          }
        }
      });
    }, 30000);

    return () => window.clearInterval(timer);
  }, [tasks]);

  useEffect(() => {
    if (!selectedRoom) return;
    let isMounted = true;
    setVideoLoading(true);

    api.get<RecommendedVideo>("/content/recommended-video", {
      params: { room_id: selectedRoom, lang: "he" },
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
  }, [selectedRoom]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }} dir="rtl">
      <div style={{ padding: "4px 2px 2px" }}>
        <div className="wow-title" style={{ fontSize: 34, marginBottom: 6 }}>
          הבית שלך, השקט שלך
        </div>
        <div className="wow-muted" style={{ fontSize: 15 }}>
          בחרי אזור להתמקד בו היום והתחילי בקטן.
        </div>
      </div>

      <HomeProgress tasks={tasks} />

      {/* Main Content */}
      <div style={{ display: "grid", gap: 20 }}>
        <div className="lifestyle-card">
          <div className="lifestyle-title">
            היום שלך
          </div>
          <div className="lifestyle-muted" style={{ marginBottom: 12 }}>
            מבט מהיר ליומן ולמשימות הקרובות.
          </div>
          <WeeklyCalendarStrip tasks={tasks} onToggleComplete={toggleTask} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr .7fr",
            gap: 20,
          }}
        >
          <div className="lifestyle-card">
            <div className="lifestyle-title">
              משימות לפי חדר
            </div>

            <div style={{ marginTop: 16 }}>
              <RoomSelector
                selectedRoom={selectedRoom}
                onSelectRoom={setSelectedRoom}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <TaskList
                tasks={filteredTasks}
                  onTaskToggle={toggleTask}
              />
            </div>
          </div>

          <div className="lifestyle-card">
            <div className="lifestyle-title">
              צפי בסרטון קצר
            </div>
            <div className="lifestyle-muted" style={{ marginBottom: 12 }}>
              סרטון מהערוץ של אלי, מותאם לחדר שבחרת.
            </div>

            {videoLoading ? (
              <div className="wow-skeleton" style={{ height: 100, borderRadius: 14 }} />
            ) : recommendedVideo?.url ? (
              <a
                href={recommendedVideo.url}
                target="_blank"
                rel="noreferrer"
                className="wow-btn wow-btnPrimary"
              >
                פתחי סרטון מומלץ
              </a>
            ) : (
              <a
                href="https://www.youtube.com/@EliMaor555"
                target="_blank"
                rel="noreferrer"
                className="wow-btn"
              >
                מעבר לערוץ של אלי
              </a>
            )}

            {recommendedVideo?.title && (
              <div className="wow-muted" style={{ marginTop: 10, fontSize: 13 }}>
                {recommendedVideo.title}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
