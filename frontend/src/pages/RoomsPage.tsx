import { useMemo, useState } from "react";
import { useRooms } from "../hooks/useRooms";
import { RoomCard } from "../components/RoomCard";
import { RoomCardSkeleton } from "../components/SkeletonLoader";
import { useTranslation } from "react-i18next";
import api from "../api";
import { showError, showSuccess } from "../utils/toast";
import InteractiveHouseMap from "../components/InteractiveHouseMap";

export const RoomsPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        allRooms: "All Rooms",
        noRoomsTitle: "No rooms yet",
        noRoomsSub: "Create your first room to get started.",
        createFirstRoom: "Create first room",
        yourRooms: "Your Rooms",
        tagline: "Every room is a fresh start.",
        createTitle: "Create a new room",
        createSub: "Start with one area that feels important right now.",
        roomNameLabel: "Room name",
        roomNamePlaceholder: "e.g. Kids Room, Storage, Balcony",
        creating: "Creating...",
        createBtn: "Add room",
        createSuccess: "Room created successfully.",
        createFail: "Could not create room right now.",
        roomRequired: "Please enter a room name.",
        statsTitle: "Home overview",
        statsRooms: "Total rooms",
        mapTitle: "House map",
        mapSub: "Tap any room on the floor plan to open its tasks.",
        cardsTitle: "Room cards",
        ideasTitle: "Quick ideas",
        ideas1: "Pick one room to focus on this week.",
        ideas2: "Create one tiny task for each room.",
        ideas3: "Start from the room that gives the biggest calm.",
      }
    : {
        allRooms: "כל החדרים",
        noRoomsTitle: "אין חדרים כרגע",
        noRoomsSub: "צור חדר ראשון כדי להתחיל.",
        createFirstRoom: "צור חדר ראשון",
        yourRooms: "החדרים שלך",
        tagline: "כל חדר הוא התחלה חדשה.",
        createTitle: "יצירת חדר חדש",
        createSub: "נתחיל מאזור אחד שחשוב לך לסדר עכשיו.",
        roomNameLabel: "שם החדר",
        roomNamePlaceholder: "לדוגמה: חדר ילדים, מחסן, מרפסת",
        creating: "יוצר...",
        createBtn: "הוספת חדר",
        createSuccess: "החדר נוצר בהצלחה.",
        createFail: "לא הצלחנו ליצור חדר כרגע.",
        roomRequired: "נא להזין שם חדר.",
        statsTitle: "תמונת מצב ביתית",
        statsRooms: "סה״כ חדרים",
        mapTitle: "מפת בית אינטראקטיבית",
        mapSub: "לחצי על כל חדר במפה כדי לעבור למשימות שלו.",
        cardsTitle: "כרטיסי חדרים",
        ideasTitle: "רעיונות התחלה",
        ideas1: "בחרי חדר אחד להתמקד בו השבוע.",
        ideas2: "צרי משימה קטנה אחת לכל חדר.",
        ideas3: "התחילי מהחדר שייתן הכי הרבה שקט.",
      };
  const { data: rooms = [], isLoading: loading, refetch } = useRooms();
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  const roomCount = useMemo(() => rooms.length, [rooms]);

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newRoomName.trim();
    if (!name) {
      showError(t.roomRequired);
      return;
    }

    setCreating(true);
    try {
      await api.post("/rooms", { name });
      setNewRoomName("");
      showSuccess(t.createSuccess);
      await refetch();
    } catch (error: any) {
      // Handle network/server errors specifically
      const isNetworkError = error?.code === 'ERR_NETWORK' || 
                             error?.code === 'ERR_FAILED' || 
                             error?.message?.includes('Network Error') ||
                             error?.message?.includes('Failed');
      
      if (isNetworkError) {
        showError(isEnglish 
          ? "Cannot connect to server. Please check if the backend is running on http://localhost:8000"
          : "לא ניתן להתחבר לשרת. אנא ודא שהשרת רץ על http://localhost:8000"
        );
      } else {
        showError(error?.response?.data?.detail ?? t.createFail);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="pageBg pageBg--room" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="pageOverlay" />
        <div className="pageContent">
          <h1 className="text-2xl font-bold mb-4">📦 {t.allRooms}</h1>
          <RoomCardSkeleton count={4} />
        </div>
      </div>
    );
  }


  return (
    <div className="pageBg pageBg--room" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>
        <div className="lifestyle-card">
          <div className="lifestyle-title">
            {t.yourRooms}
          </div>
          <div className="lifestyle-muted">
            {t.tagline}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="lifestyle-card">
            <div className="lifestyle-title">{t.statsTitle}</div>
            <div className="wow-muted">{t.statsRooms}</div>
            <div className="wow-title" style={{ fontSize: 32, marginTop: 8 }}>{roomCount}</div>
          </div>
          <div className="lifestyle-card">
            <div className="lifestyle-title">{t.ideasTitle}</div>
            <div className="wow-muted" style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <span>• {t.ideas1}</span>
              <span>• {t.ideas2}</span>
              <span>• {t.ideas3}</span>
            </div>
          </div>
        </div>

        <div className="lifestyle-card">
          <div className="lifestyle-title">{t.createTitle}</div>
          <div className="lifestyle-muted" style={{ marginBottom: 12 }}>{t.createSub}</div>
          <form onSubmit={handleCreateRoom} style={{ display: "grid", gap: 10 }}>
            <label className="label">{t.roomNameLabel}</label>
            <input
              className="input"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder={t.roomNamePlaceholder}
              disabled={creating}
            />
            <button type="submit" className="wow-btn wow-btnPrimary" disabled={creating}>
              {creating ? t.creating : t.createBtn}
            </button>
          </form>
        </div>

        <div className="lifestyle-card">
          <div className="lifestyle-title">{t.mapTitle}</div>
          <div className="lifestyle-muted" style={{ marginBottom: 14 }}>{t.mapSub}</div>
          <InteractiveHouseMap rooms={rooms} />
        </div>

        {rooms && rooms.length > 0 && (
          <>
            <div className="lifestyle-card">
              <div className="lifestyle-title">{t.cardsTitle}</div>
              <div className="lifestyle-muted" style={{ marginBottom: 10 }}>{t.tagline}</div>
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
          </>
        )}
      </main>
    </div>
  );
};
