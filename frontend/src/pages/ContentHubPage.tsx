import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { showError } from "../utils/toast";
import { useTranslation } from "react-i18next";
import type { AxiosError } from "axios";

type VideoItem = {
  title: string;
  category: string;
  difficulty: string;
  time_minutes: number;
  tip: string;
  example: string;
  video: string;
};

type HubResponse = {
  room: string | null;
  category: string | null;
  difficulty: string | null;
  max_minutes: number | null;
  items: VideoItem[];
  taxonomy: {
    rooms: string[];
    categories: string[];
    difficulty: string[];
    time: number[];
  };
  source: string;
};

const ROOM_OPTIONS = [
  { key: "kitchen", he: "מטבח", en: "Kitchen" },
  { key: "living_room", he: "סלון", en: "Living Room" },
  { key: "bedroom", he: "חדר שינה", en: "Bedroom" },
  { key: "closet", he: "ארון", en: "Closet" },
  { key: "bathroom", he: "אמבטיה", en: "Bathroom" },
];

export default function ContentHubPage() {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        title: "Content Hub",
        subtitle: "Smart content by room, category, difficulty and time.",
        room: "Room",
        category: "Category",
        difficulty: "Difficulty",
        maxTime: "Max Time (minutes)",
        all: "All",
        loading: "Loading...",
        empty: "No videos found for this filter. Try a broader selection.",
        watch: "Watch",
        loadFail: "Failed to load content hub",
      }
    : {
        title: "ספריית תוכן",
        subtitle: "תוכן חכם לפי חדר, קטגוריה, רמת קושי וזמן.",
        room: "חדר",
        category: "קטגוריה",
        difficulty: "רמת קושי",
        maxTime: "זמן מקסימלי (בדקות)",
        all: "הכול",
        loading: "טוען...",
        empty: "לא נמצאו סרטונים לסינון הזה. נסי בחירה רחבה יותר.",
        watch: "לצפייה",
        loadFail: "טעינת ספריית התוכן נכשלה",
      };

  const [room, setRoom] = useState("kitchen");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [data, setData] = useState<HubResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedRoomLabel = useMemo(() => {
    const found = ROOM_OPTIONS.find((x) => x.key === room);
    return isEnglish ? found?.en : found?.he;
  }, [room, isEnglish]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<HubResponse>("/content/engine", {
        params: {
          room,
          category: category || undefined,
          difficulty: difficulty || undefined,
          max_minutes: maxMinutes ? Number(maxMinutes) : undefined,
          lang: isEnglish ? "en" : "he",
        },
      });
      setData(res.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      showError(axiosError?.response?.data?.detail ?? t.loadFail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [room, category, difficulty, maxMinutes, isEnglish]);

  useEffect(() => {
    setCategory("");
    setDifficulty("");
    setMaxMinutes("");
  }, [room]);

  return (
    <main className="pageContent" style={{ display: "grid", gap: 16 }} dir={isEnglish ? "ltr" : "rtl"}>
      <section className="lifestyle-card">
        <div className="lifestyle-title">{t.title}</div>
        <div className="lifestyle-muted">
          {t.subtitle} {selectedRoomLabel ? `• ${selectedRoomLabel}` : ""}
        </div>
      </section>

      <section className="lifestyle-card" style={{ display: "grid", gap: 10 }}>
        <label className="label">{t.room}</label>
        <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
          {ROOM_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {isEnglish ? option.en : option.he}
            </option>
          ))}
        </select>

        <label className="label">{t.category}</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t.all}</option>
          {(data?.taxonomy.categories || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="label">{t.difficulty}</label>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">{t.all}</option>
          {(data?.taxonomy.difficulty || []).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label className="label">{t.maxTime}</label>
        <select className="input" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)}>
          <option value="">{t.all}</option>
          {(data?.taxonomy.time || []).map((m) => (
            <option key={m} value={String(m)}>
              {m}
            </option>
          ))}
        </select>
      </section>

      <section className="lifestyle-card">
        {loading ? (
          <div className="wow-skeleton" style={{ height: 120 }} />
        ) : !data?.items?.length ? (
          <div className="wow-muted">{t.empty}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {data.items.map((item, idx) => (
              <article key={`${item.title}-${idx}`} className="wow-card wow-pad" style={{ display: "grid", gap: 8 }}>
                <div className="wow-title" style={{ fontSize: 18 }}>
                  {item.title}
                </div>
                <div className="wow-muted">
                  {item.category} • {item.difficulty} • {item.time_minutes}m
                </div>
                <div className="wow-muted">{item.tip}</div>
                <div style={{ fontWeight: 700, color: "#4A2BC7" }}>{item.example}</div>
                <div>
                  <a className="wow-btn wow-btnPrimary" href={item.video} target="_blank" rel="noreferrer">
                    {t.watch}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
