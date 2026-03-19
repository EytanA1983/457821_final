import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { ShoppingListCreate } from "../schemas/shopping";
import { showSuccess, showError } from "../utils/toast";
import { useTranslation } from "react-i18next";

type Room = { id: number; name: string };

export const ShoppingListCreatePage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        defaultName: "Shopping List",
        createSuccess: "✅ List created!",
        createFail: "Failed to create list",
        title: "Create Shopping List",
        name: "Name (optional):",
        namePlaceholder: "Shopping list",
        template: "Template list (reusable)",
        reminder: "Reminder (optional):",
        room: "Room (optional):",
        noRoom: "No specific room",
        save: "🛒 Save list",
      }
    : {
        defaultName: "רשימת קניות",
        createSuccess: "✅ רשימה נוצרה!",
        createFail: "שגיאה ביצירת הרשימה",
        title: "יצירת רשימת קניות",
        name: "שם (אופציונלי):",
        namePlaceholder: "רשימת קניות",
        template: "רשימת תבנית (קבועה לשימוש חוזר)",
        reminder: "תזכורת (אופציונלי):",
        room: "חדר (אופציונלי):",
        noRoom: "ללא חדר ספציפי",
        save: "🛒 שמור רשימה",
      };
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('roomId'); // Changed from 'room' to 'roomId'

  const [name, setName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [reminder, setReminder] = useState("");
  const [roomId, setRoomId] = useState<number | null>(
    roomIdFromUrl ? parseInt(roomIdFromUrl) : null
  );
  const [rooms, setRooms] = useState<Room[]>([]);
  const navigate = useNavigate();

  // Load rooms
  useEffect(() => {
    api.get<Room[]>('/rooms')
      .then((res: any) => setRooms(res.data))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ShoppingListCreate = {
      name: name.trim() || t.defaultName,
      description: null,
      is_template: isTemplate,
      reminder_time: reminder ? new Date(reminder).toISOString() : null,
      room_id: roomId,
      items: [], // אפשר להוסיף פריטים ברגע שהרשימה נוצרה
    };
    try {
      const { data } = await api.post("/shopping", payload);
      showSuccess(t.createSuccess);
      navigate(`/shopping/${data.id}`);
    } catch (err: any) {
      showError(err.response?.data?.detail ?? t.createFail);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg mx-auto p-4 bg-white rounded-lg shadow" dir={isEnglish ? "ltr" : "rtl"}>
      <h1 className="text-2xl mb-4">{t.title}</h1>

      <label className="block mb-2">
        {t.name}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="input"
        />
      </label>

      <label className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={() => setIsTemplate(!isTemplate)}
          className="ml-2"
        />
        {t.template}
      </label>

      <label className="block mb-4">
        {t.reminder}
        <input
          type="datetime-local"
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
          className="input"
        />
      </label>

      <label className="block mb-4">
        {t.room}
        <select
          value={roomId || ''}
          onChange={(e) => setRoomId(e.target.value ? parseInt(e.target.value) : null)}
          className="input"
        >
          <option value="">{t.noRoom}</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className="btn btn-sky">
        {t.save}
      </button>
    </form>
  );
};

export default ShoppingListCreatePage;
