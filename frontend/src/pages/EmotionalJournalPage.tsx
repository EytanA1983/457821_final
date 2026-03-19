import { FormEvent, useEffect, useState } from "react";
import api from "../api";
import { showError, showSuccess } from "../utils/toast";
import { EmotionalJournalEntry } from "../schemas/emotionalJournal";
import { useTranslation } from "react-i18next";

export default function EmotionalJournalPage() {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        title: "Emotional Decluttering Journal",
        subtitle: "A gentle KonMari reflection before letting go.",
        itemLabel: "Item",
        itemPlaceholder: "e.g. old sweater",
        q1: "Why am I keeping this item?",
        q1Placeholder: "Memories, comfort, habit, scarcity...",
        q2: "Does this item spark joy?",
        yes: "Yes",
        no: "No",
        save: "Save reflection",
        saved: "Reflection saved.",
        failed: "Could not save reflection.",
        empty: "No entries yet.",
        delete: "Delete",
      }
    : {
        title: "מצב סידור רגשי",
        subtitle: "רפלקציה עדינה בסגנון KonMari לפני שחרור חפצים.",
        itemLabel: "החפץ",
        itemPlaceholder: "לדוגמה: סוודר ישן",
        q1: "למה אני שומרת את החפץ הזה?",
        q1Placeholder: "זיכרון, נוחות, הרגל, תחושת מחסור...",
        q2: "האם החפץ הזה משמח אותי?",
        yes: "כן",
        no: "לא",
        save: "שמירת רפלקציה",
        saved: "הרפלקציה נשמרה.",
        failed: "לא הצלחנו לשמור רפלקציה.",
        empty: "אין עדיין רשומות.",
        delete: "מחיקה",
      };

  const [entries, setEntries] = useState<EmotionalJournalEntry[]>([]);
  const [itemName, setItemName] = useState("");
  const [whyKeep, setWhyKeep] = useState("");
  const [sparkJoy, setSparkJoy] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<EmotionalJournalEntry[]>("/emotional-journal", { params: { limit: 50 } });
      setEntries(data || []);
    } catch (err: any) {
      showError(err?.response?.data?.detail ?? text.failed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    try {
      const { data } = await api.post<EmotionalJournalEntry>("/emotional-journal", {
        item_name: itemName.trim(),
        why_keep: whyKeep.trim(),
        spark_joy: sparkJoy,
      });
      setEntries((prev) => [data, ...prev]);
      setItemName("");
      setWhyKeep("");
      setSparkJoy(true);
      showSuccess(text.saved);
    } catch (err: any) {
      showError(err?.response?.data?.detail ?? text.failed);
    }
  };

  const removeEntry = async (id: number) => {
    try {
      await api.delete(`/emotional-journal/${id}`);
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      showError(err?.response?.data?.detail ?? text.failed);
    }
  };

  return (
    <main className="pageContent" dir={isEnglish ? "ltr" : "rtl"} style={{ display: "grid", gap: 20 }}>
      <section className="lifestyle-card">
        <div className="lifestyle-title">{text.title}</div>
        <div className="lifestyle-muted">{text.subtitle}</div>
      </section>

      <section className="lifestyle-card">
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <label className="label">{text.itemLabel}</label>
          <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={text.itemPlaceholder} />
          <label className="label">{text.q1}</label>
          <textarea className="input" value={whyKeep} onChange={(e) => setWhyKeep(e.target.value)} placeholder={text.q1Placeholder} />
          <label className="label">{text.q2}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`wow-btn ${sparkJoy ? "wow-btnPrimary" : ""}`} onClick={() => setSparkJoy(true)}>{text.yes}</button>
            <button type="button" className={`wow-btn ${!sparkJoy ? "wow-btnPrimary" : ""}`} onClick={() => setSparkJoy(false)}>{text.no}</button>
          </div>
          <button type="submit" className="wow-btn wow-btnPrimary">{text.save}</button>
        </form>
      </section>

      <section className="lifestyle-card">
        {loading ? (
          <div className="wow-skeleton" style={{ height: 80 }} />
        ) : entries.length === 0 ? (
          <p className="wow-muted">{text.empty}</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {entries.map((entry) => (
              <article key={entry.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{entry.item_name}</div>
                  <button type="button" className="wow-btn" onClick={() => removeEntry(entry.id)}>{text.delete}</button>
                </div>
                <div className="wow-muted" style={{ marginTop: 6 }}>{entry.why_keep || "-"}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`wow-chip ${entry.spark_joy ? "wow-chipAccent" : ""}`}>
                    {text.q2}: {entry.spark_joy ? text.yes : text.no}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
