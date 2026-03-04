import { useRooms } from "../hooks/useRooms";
import { RoomCard } from "../components/RoomCard";
import { Link } from "react-router-dom";
import { ROUTES } from "../utils/routes";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { RoomCardSkeleton } from "../components/SkeletonLoader";

export const RoomsPage = () => {
  const { data: rooms = [], isLoading: loading } = useRooms();

  if (loading) {
    return (
      <div className="pageBg pageBg--room" dir="rtl">
        <div className="pageOverlay" />
        <div className="pageContent">
          <h1 className="text-2xl font-bold mb-4">📦 כל החדרים</h1>
          <RoomCardSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="pageBg pageBg--room" dir="rtl">
        <div className="pageOverlay" />
        <div className="pageContent">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 max-w-md w-full text-center">
            <span className="emoji text-6xl block mb-6">🏡</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-4">
              אין חדרים כרגע
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm">
              צור חדר ראשון להתחיל
            </p>
            <Link
              to={ROUTES.ROOMS}
              className="btn btn-sky touch-target inline-flex items-center justify-center gap-2 px-6 py-3 text-lg"
            >
              <span className="emoji">➕</span>
              צור חדר ראשון
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageBg pageBg--room" dir="rtl">
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>

      <div className="lifestyle-card">
        <div className="lifestyle-title">
          החדרים שלך
        </div>
        <div className="lifestyle-muted">
          כל חדר הוא התחלה חדשה.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20
        }}
      >
        {rooms.map((room) => (
          <div key={room.id} className="lifestyle-card">
            <RoomCard roomId={room.id} name={room.name} />
          </div>
        ))}
      </div>
      </main>
    </div>
  );
};
