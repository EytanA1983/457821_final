import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TaskList from "../components/TaskList";
import api from "../api";

type RecommendedVideo = {
  videoId: string | null;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
};

/**
 * RoomPage - עמוד חדר עם משימות
 * 
 * גרסה פשוטה:
 * - טוען משימות לפי roomId
 * - מציג TaskList
 * - מאפשר toggle של משימות
 */
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const roomIdNum = useMemo(() => Number(roomId), [roomId]);
  const isInvalidRoomId = Number.isNaN(roomIdNum);
  const [recommendedVideo, setRecommendedVideo] = useState<RecommendedVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    if (!roomId || isInvalidRoomId) return;

    let isMounted = true;
    setVideoLoading(true);
    api
      .get<RecommendedVideo>("/content/recommended-video", {
        params: { room_id: roomId, lang: "he" },
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
  }, [isInvalidRoomId, roomId]);

  return (
    <div className="pageBg pageBg--room" dir="rtl">
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>

      <div className="lifestyle-card">
        <div className="lifestyle-title">
          {roomId ? `חדר: ${roomId}` : "חדר"}
        </div>
        <div className="lifestyle-muted">
          כאן תראי את המשימות השייכות לאזור שבחרת.
        </div>
      </div>

      <div className="lifestyle-card" dir="rtl">
        <div className="lifestyle-title">צפי בסרטון קצר</div>
        <div className="lifestyle-muted" style={{ marginBottom: 12 }}>
          מותאם לחדר שבחרת, רק מתוך הערוץ של אלי.
        </div>
        {videoLoading ? (
          <div className="wow-skeleton" style={{ height: 110, borderRadius: 16 }} />
        ) : recommendedVideo?.url ? (
          <a
            href={recommendedVideo.url}
            target="_blank"
            rel="noreferrer"
            className="wow-btn wow-btnPrimary"
            style={{ display: "inline-flex", marginBottom: 10 }}
          >
            פתחי סרטון מומלץ
          </a>
        ) : (
          <a
            href="https://www.youtube.com/@EliMaor555"
            target="_blank"
            rel="noreferrer"
            className="wow-btn"
            style={{ display: "inline-flex", marginBottom: 10 }}
          >
            מעבר לערוץ של אלי
          </a>
        )}

        {recommendedVideo?.thumbnail && (
          <a href={recommendedVideo.url || undefined} target="_blank" rel="noreferrer">
            <img
              src={recommendedVideo.thumbnail}
              alt={recommendedVideo.title || "סרטון מומלץ"}
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: 16,
                border: "1px solid var(--border)",
                display: "block",
                marginTop: 8,
              }}
              loading="lazy"
            />
          </a>
        )}

        {recommendedVideo?.title && (
          <div className="wow-muted" style={{ marginTop: 8 }}>
            {recommendedVideo.title}
          </div>
        )}
      </div>

      {isInvalidRoomId ? (
        <div className="lifestyle-card">
          <div className="lifestyle-title">
            חדר לא זמין
          </div>
          <div className="lifestyle-muted">
            נראה שהמזהה אינו תקין. נעדכן את הלוגיקה בהתאם ל-API.
          </div>
        </div>
      ) : (
        <div className="lifestyle-card">
          <TaskList filter={{ roomId: roomIdNum || undefined }} />
        </div>
      )}

      </main>
    </div>
  );
}
