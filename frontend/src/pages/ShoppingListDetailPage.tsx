import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { ShoppingListRead, ShoppingItemCreate } from "../schemas/shopping";
import { showError, showSuccess } from "../utils/toast";
import { useTranslation } from "react-i18next";

export const ShoppingListDetailPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        loadError: "Load error",
        itemAdded: "✅ Item added",
        addError: "Error adding item",
        updateError: "Update error",
        loading: "⏳ Loading...",
        reminder: "Reminder:",
        newItemPlaceholder: "New item...",
        add: "Add",
      }
    : {
        loadError: "שגיאת טעינה",
        itemAdded: "✅ פריט נוסף",
        addError: "שגיאה בהוספת פריט",
        updateError: "שגיאה בעדכון",
        loading: "⏳ טוען...",
        reminder: "תזכורת:",
        newItemPlaceholder: "פריט חדש...",
        add: "הוסף",
      };
  const { listId } = useParams<{ listId: string }>();
  const [list, setList] = useState<ShoppingListRead | null>(null);
  const [newItem, setNewItem] = useState("");

  const load = () => {
    api
      .get<ShoppingListRead>(`/shopping/${listId}`)
      .then((r) => setList(r.data))
      .catch((e) => showError(e.response?.data?.detail ?? t.loadError));
  };

  useEffect(() => {
    load();
  }, [listId]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    const payload: ShoppingItemCreate = {
      name: newItem.trim(),
      quantity: null,
      category: null,
      notes: null,
      is_fixed: false,
      order: list?.items.length || 0,
    };

    try {
      await api.post(`/shopping/${listId}/items`, payload);
      setNewItem("");
      showSuccess(t.itemAdded);
      load(); // ריענון
    } catch (err: any) {
      showError(err.response?.data?.detail ?? t.addError);
    }
  };

  const toggleItem = async (itemId: number, currentChecked: boolean) => {
    try {
      await api.patch(`/shopping/items/${itemId}`, {
        is_checked: !currentChecked,
      });
      load();
    } catch (err: any) {
      showError(err.response?.data?.detail ?? t.updateError);
    }
  };

  if (!list) return <div className="p-4">{t.loading}</div>;

  return (
    <section className="max-w-2xl mx-auto p-4" dir={isEnglish ? "ltr" : "rtl"}>
      <h1 className="text-2xl font-semibold mb-2">{list.name}</h1>

      {list.reminder_time && (
        <p className="text-sm text-amber-600 mb-4">
          {t.reminder} {new Date(list.reminder_time).toLocaleString()}
        </p>
      )}

      <ul className="space-y-2 mb-6">
        {list.items.map((it) => (
          <li key={it.id} className="flex items-center">
            <input
              type="checkbox"
              checked={it.is_checked}
              onChange={() => toggleItem(it.id, it.is_checked)}
              className="ml-2"
            />
            <span className={`flex-1 ${it.is_checked ? "line-through text-gray-500" : ""}`}>
              {it.name}
              {it.is_fixed && <span className="emoji mr-1">🔁</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* הוספת פריט */}
      <form onSubmit={addItem} className="flex gap-2">
        <input
          type="text"
          placeholder={t.newItemPlaceholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="flex-1 input"
        />
        <button type="submit" className="btn btn-sky">
          {t.add}
        </button>
      </form>
    </section>
  );
};

export default ShoppingListDetailPage;
