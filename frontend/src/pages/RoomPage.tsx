import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { useTranslation } from "react-i18next";
import { useRooms } from "../hooks/useRooms";
import { useTasks } from "../hooks/useTasks";
import { ROUTES } from "../utils/routes";
import type { RoomRead } from "../schemas/room";
import type { TaskRead } from "../schemas/task";

type RecommendedVideo = {
  videoId: string | null;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
};

type RoomTask = {
  id: number;
  title: string;
  completed: boolean;
};

export default function RoomPage() {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        room: "Room",
        roomDesc: "Tasks, one quick tip, and one relevant video.",
        tasksTitle: "Tasks",
        addTask: "+ Add task",
        tasksLoading: "Loading tasks...",
        taskUpdateFailed: "Could not update task.",
        noTasks: "No tasks in this room yet.",
        noTasksHint: "Start with one small task of 5 minutes.",
        tipTitle: "Quick tip",
        videoTitle: "Video tip",
        watchVideoSub: "A short recommendation for this room.",
        goToChannel: "Go to Eli's channel",
        recommendedAlt: "Recommended video",
        roomUnavailable: "Room is unavailable",
        invalidRoom: "The room ID seems invalid.",
        completedLabel: (completed: number, total: number) => `${completed}/${total} completed`,
      }
    : {
        room: "חדר",
        roomDesc: "משימות, טיפ קצר, וסרטון רלוונטי לחדר.",
        tasksTitle: "משימות",
        addTask: "+ הוסיפי משימה",
        tasksLoading: "טוען משימות...",
        taskUpdateFailed: "לא הצלחנו לעדכן את המשימה.",
        noTasks: "אין משימות בחדר הזה כרגע.",
        noTasksHint: "התחילי ממשימה קטנה של 5 דקות.",
        tipTitle: "טיפ קצר",
        videoTitle: "סרטון רלוונטי",
        watchVideoSub: "המלצה קצרה שמתאימה לחדר שבחרת.",
        goToChannel: "מעבר לערוץ של אלי",
        recommendedAlt: "סרטון מומלץ",
        roomUnavailable: "חדר לא זמין",
        invalidRoom: "נראה שמזהה החדר אינו תקין.",
        completedLabel: (completed: number, total: number) => `${completed}/${total} הושלמו`,
      };
  const { roomId } = useParams<{ roomId: string }>();
  const roomIdNum = useMemo(() => Number(roomId), [roomId]);
  const isInvalidRoomId = Number.isNaN(roomIdNum);
  const { data: rooms = [] } = useRooms();
  const {
    data: tasksData = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useTasks({ roomId: roomIdNum || undefined }, { enabled: !isInvalidRoomId });
  const [recommendedVideo, setRecommendedVideo] = useState<RecommendedVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const room = useMemo<RoomRead | null>(() => {
    return (rooms as RoomRead[]).find((r) => Number(r.id) === roomIdNum) || null;
  }, [rooms, roomIdNum]);

  const roomName = room?.name || `${t.room} ${roomIdNum}`;

  const roomEmoji = useMemo(() => {
    const value = (room?.name || "").toLowerCase();
    if (value.includes("מטבח") || value.includes("kitchen")) return "🍳";
    if (value.includes("סלון") || value.includes("living")) return "🏠";
    if (value.includes("שינה") || value.includes("bed")) return "🛏️";
    if (value.includes("ארון") || value.includes("closet")) return "👕";
    if (value.includes("ילדים") || value.includes("kids")) return "🧸";
    if (value.includes("מקלחת") || value.includes("bath")) return "🛁";
    return "✨";
  }, [room?.name]);

  const roomTip = useMemo(() => {
    const value = (room?.name || "").toLowerCase();
    if (value.includes("מטבח") || value.includes("kitchen")) {
      return isEnglish
        ? "Start with one drawer only. Keep, donate, or throw away."
        : "התחילי ממגירה אחת בלבד. להשאיר, לתרום או לזרוק.";
    }
    if (value.includes("שינה") || value.includes("bed")) {
      return isEnglish
        ? "Fold 10 items only. Small wins build momentum."
        : "קפלי 10 פריטים בלבד. ניצחונות קטנים בונים מומנטום.";
    }
    if (value.includes("סלון") || value.includes("living")) {
      return isEnglish
        ? "Clear one visible surface first for instant calm."
        : "פני קודם משטח אחד בולט לעין כדי להרגיש שקט מיידי.";
    }
    return isEnglish
      ? "Pick one tiny area and set a 5-minute timer."
      : "בחרי אזור קטן והגדירי טיימר של 5 דקות.";
  }, [isEnglish, room?.name]);

  const tasks = useMemo<RoomTask[]>(() => {
    return (tasksData as TaskRead[])
      .map((task) => ({
        id: Number(task.id),
        title: task.title || (isEnglish ? "Task" : "משימה"),
        completed: Boolean(task.completed),
      }))
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [isEnglish, tasksData]);

  const completedCount = tasks.filter((task) => task.completed).length;

  const embeddedVideoUrl = useMemo(() => {
    if (recommendedVideo?.videoId) {
      return `https://www.youtube.com/embed/${recommendedVideo.videoId}`;
    }
    if (recommendedVideo?.url) {
      const match = recommendedVideo.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
      if (match?.[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    return "https://www.youtube.com/embed/BM5vN7ekfA8";
  }, [recommendedVideo]);

  useEffect(() => {
    if (!roomId || isInvalidRoomId) return;

    let isMounted = true;
    setVideoLoading(true);
    api
      .get<RecommendedVideo>("/content/recommended-video", {
        params: { room_id: roomId, lang: isEnglish ? "en" : "he" },
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
  }, [isEnglish, isInvalidRoomId, roomId]);

  const toggleTask = async (task: RoomTask) => {
    if (!task?.id || updatingTaskId) return;
    setUpdatingTaskId(task.id);
    try {
      await api.put(`/tasks/${task.id}`, { completed: !task.completed });
      await refetchTasks();
    } catch {
      // Keep UX simple in room page - avoid toast dependency.
      window.alert(t.taskUpdateFailed);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="pageBg pageBg--room" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>

      <div className="lifestyle-card">
        <div className="lifestyle-title">
          {roomEmoji} {roomName}
        </div>
        <div className="lifestyle-muted">
          {t.roomDesc} {tasks.length > 0 ? `• ${t.completedLabel(completedCount, tasks.length)}` : ""}
        </div>
      </div>

      {isInvalidRoomId ? (
        <div className="lifestyle-card">
          <div className="lifestyle-title">
            {t.roomUnavailable}
          </div>
          <div className="lifestyle-muted">
            {t.invalidRoom}
          </div>
        </div>
      ) : (
        <div className="lifestyle-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="lifestyle-title">{t.tasksTitle}</div>
            <Link className="wow-btn wow-btnPrimary" to={`${ROUTES.ADD_TASK}?roomId=${roomIdNum}`}>
              {t.addTask}
            </Link>
          </div>

          {tasksLoading ? (
            <div className="lifestyle-muted">{t.tasksLoading}</div>
          ) : tasks.length === 0 ? (
            <div className="lifestyle-muted">
              {t.noTasks}
              <br />
              {t.noTasksHint}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="wow-btn"
                  onClick={() => toggleTask(task)}
                  disabled={updatingTaskId === task.id}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    opacity: updatingTaskId === task.id ? 0.75 : 1,
                    textDecoration: task.completed ? "line-through" : "none",
                  }}
                >
                  {task.completed ? "✔ " : "○ "} {task.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="lifestyle-card">
        <div className="lifestyle-title">{t.tipTitle}</div>
        <div className="lifestyle-muted">{roomTip}</div>
      </div>

      <div className="lifestyle-card" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="lifestyle-title">{t.videoTitle}</div>
        <div className="lifestyle-muted" style={{ marginBottom: 12 }}>
          {t.watchVideoSub}
        </div>
        {videoLoading ? (
          <div className="wow-skeleton" style={{ height: 180, borderRadius: 16 }} />
        ) : (
          <iframe
            title={recommendedVideo?.title || t.recommendedAlt}
            src={embeddedVideoUrl}
            className="inspiration-embed"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}

        <a
          href={recommendedVideo?.url || "https://www.youtube.com/@EliMaor555"}
          target="_blank"
          rel="noreferrer"
          className="wow-btn"
          style={{ display: "inline-flex", marginTop: 10 }}
        >
          {t.goToChannel}
        </a>
      </div>

      </main>
    </div>
  );
}
