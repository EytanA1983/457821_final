import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { ShoppingListRead } from "../schemas/shopping";
import { showError } from "../utils/toast";
import { Modal } from "../components/Modal";
import { useTranslation } from "react-i18next";

export const ShoppingListsPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        loadError: "Failed to load shopping lists",
        loading: "Loading...",
        title: "Shopping Lists",
        showingFor: "Showing lists for:",
        showAll: "Show all",
        create: "📋 Create new list",
        empty: "No lists yet. Create one!",
        items: "items",
        template: "(template)",
        reminder: "Reminder:",
        reuseTitle: "🛒 Reuse your previous list?",
        yesUse: "✅ Yes, use it",
        noCreate: "➕ No, create new",
      }
    : {
        loadError: "שגיאה בטעינת רשימות",
        loading: "⏳ טוען...",
        title: "רשימות קניות",
        showingFor: "מציג רשימות ל:",
        showAll: "הצג הכל",
        create: "📋 צור רשימה חדשה",
        empty: "אין עדיין רשימות. צור אחת!",
        items: "פריטים",
        template: "(תבנית)",
        reminder: "תזכורת:",
        reuseTitle: "🛒 השתמש ברשימה הקודמת?",
        yesUse: "✅ כן, השתמש",
        noCreate: "➕ לא, צור חדשה",
      };
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId'); // Changed from 'room' to 'roomId'
  const [lists, setLists] = useState<ShoppingListRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      setRoomName(null);
      return;
    }
    const id = Number(roomId);
    if (!Number.isFinite(id)) {
      setRoomName(null);
      return;
    }
    api
      .get<{ name: string }>(`/rooms/${id}`)
      .then((res) => setRoomName(res.data.name))
      .catch(() => setRoomName(null));
  }, [roomId]);

  useEffect(() => {
    api
      .get<ShoppingListRead[]>("/shopping")
      .then((res) => {
        setLists(res.data);

        // Check if there's a last non-template list
        const lastList = res.data.find((l) => !l.is_template);
        if (lastList) {
          setShowPrompt(true);
        }
      })
      .catch((err) => showError(err.response?.data?.detail ?? t.loadError))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">{t.loading}</div>;

  const lastList = lists.find((l) => !l.is_template);

  return (
    <section className="max-w-4xl mx-auto p-4" dir={isEnglish ? "ltr" : "rtl"}>
      <h1 className="text-2xl font-semibold mb-4">{t.title}</h1>

      {/* Room Context */}
      {roomId && roomName && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-200">
            <span className="emoji">📍</span> {t.showingFor} <strong>{roomName}</strong>
          </span>
          <Link to="/shopping" className="text-blue-600 dark:text-blue-400 hover:underline">
            {t.showAll}
          </Link>
        </div>
      )}

      <Link
        to={roomId ? `/shopping/new?roomId=${roomId}` : "/shopping/new"}
        className="btn btn-sky mb-6 inline-block"
      >
        {t.create}
      </Link>

      {lists.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {lists.map((lst) => (
            <li
              key={lst.id}
              className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition"
            >
              <Link to={`/shopping/${lst.id}`} className="block">
                <h2 className="font-medium text-lg">{lst.name}</h2>
                <p className="text-sm text-gray-600">
                  {lst.items.length} {t.items} {lst.is_template && t.template}
                </p>
                {lst.reminder_time && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t.reminder} {new Date(lst.reminder_time).toLocaleString()}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Prompt Modal */}
      {showPrompt && lastList && (
        <Modal onClose={() => setShowPrompt(false)}>
          <h2 className="text-xl font-semibold mb-4">{t.reuseTitle}</h2>
          <p className="text-gray-600 mb-2">
            <strong>{lastList.name}</strong> – {lastList.items.length} {t.items}
          </p>
          {lastList.reminder_time && (
            <p className="text-sm text-amber-600 mb-4">
              {t.reminder} {new Date(lastList.reminder_time).toLocaleString()}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              className="btn btn-sky flex-1"
              onClick={() => {
                navigate(`/shopping/${lastList.id}`);
                setShowPrompt(false);
              }}
            >
              {t.yesUse}
            </button>
            <button
              className="btn btn-coral flex-1"
              onClick={() => {
                navigate("/shopping/new");
                setShowPrompt(false);
              }}
            >
              {t.noCreate}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
};

export default ShoppingListsPage;
