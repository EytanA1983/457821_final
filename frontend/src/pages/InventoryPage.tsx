import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { InventoryAreaRead, InventoryItemRead } from "../schemas/inventory";
import { showError, showSuccess } from "../utils/toast";
import { useTranslation } from "react-i18next";

export default function InventoryPage() {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        title: "Home Inventory",
        subtitle: "Catalog items by storage area with quantity and photos.",
        areaName: "Area name",
        areaPlaceholder: "e.g. Wardrobe",
        addArea: "Add area",
        itemName: "Item name",
        itemPlaceholder: "e.g. T-shirts",
        quantity: "Quantity",
        photoUrl: "Photo URL",
        markDonated: "Mark as donated",
        addItem: "Add item",
        noAreas: "No areas yet. Add your first area.",
        noItems: "No items in this area yet.",
      }
    : {
        title: "קטלוג חפצים בבית",
        subtitle: "סדרי חפצים לפי אזורים עם כמות ותמונה.",
        areaName: "שם אזור",
        areaPlaceholder: "לדוגמה: ארון בגדים",
        addArea: "הוספת אזור",
        itemName: "שם פריט",
        itemPlaceholder: "לדוגמה: חולצות",
        quantity: "כמות",
        photoUrl: "קישור לתמונה",
        markDonated: "סמני כנתרם",
        addItem: "הוספת פריט",
        noAreas: "אין עדיין אזורים. הוסיפי אזור ראשון.",
        noItems: "אין פריטים באזור זה עדיין.",
      };

  const [areas, setAreas] = useState<InventoryAreaRead[]>([]);
  const [items, setItems] = useState<InventoryItemRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [areaName, setAreaName] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [photoUrl, setPhotoUrl] = useState("");
  const [isDonated, setIsDonated] = useState(false);

  const selectedItems = useMemo(
    () => items.filter((it) => (selectedAreaId ? it.area_id === selectedAreaId : true)),
    [items, selectedAreaId]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [areasRes, itemsRes] = await Promise.all([
        api.get<InventoryAreaRead[]>("/inventory/areas").catch((err) => {
          // If 404, return empty array (no areas yet)
          if (err?.response?.status === 404) {
            return { data: [] };
          }
          throw err;
        }),
        api.get<InventoryItemRead[]>("/inventory/items").catch((err) => {
          // If 404, return empty array (no items yet)
          if (err?.response?.status === 404) {
            return { data: [] };
          }
          throw err;
        }),
      ]);
      setAreas(areasRes.data || []);
      setItems(itemsRes.data || []);
      if (!selectedAreaId && (areasRes.data || []).length > 0) {
        setSelectedAreaId(areasRes.data[0].id);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const isNetworkError = e?.code === 'ERR_NETWORK' || e?.code === 'ERR_FAILED';
      
      if (isNetworkError) {
        showError(isEnglish 
          ? "Cannot connect to server. Please check if the backend is running on http://localhost:8000"
          : "לא ניתן להתחבר לשרת. אנא ודא שהשרת רץ על http://localhost:8000"
        );
      } else if (status === 404) {
        // 404 is OK - just means no data yet
        setAreas([]);
        setItems([]);
      } else {
        showError(e?.response?.data?.detail ?? (isEnglish ? "Failed to load inventory" : "שגיאה בטעינת הקטלוג"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) return;
    try {
      const { data } = await api.post<InventoryAreaRead>("/inventory/areas", { name: areaName.trim() });
      setAreaName("");
      setAreas((prev) => [data, ...prev]);
      setSelectedAreaId(data.id);
      showSuccess(isEnglish ? "Area created" : "האזור נוצר");
    } catch (err: any) {
      showError(err?.response?.data?.detail ?? (isEnglish ? "Failed to create area" : "שגיאה ביצירת אזור"));
    }
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId || !itemName.trim()) return;
    try {
      const { data } = await api.post<InventoryItemRead>("/inventory/items", {
        area_id: selectedAreaId,
        name: itemName.trim(),
        quantity,
        photo_url: photoUrl.trim() || null,
        is_donated: isDonated,
      });
      setItems((prev) => [data, ...prev]);
      setItemName("");
      setQuantity(1);
      setPhotoUrl("");
      setIsDonated(false);
      showSuccess(isEnglish ? "Item added" : "הפריט נוסף");
    } catch (err: any) {
      showError(err?.response?.data?.detail ?? (isEnglish ? "Failed to add item" : "שגיאה בהוספת פריט"));
    }
  };

  return (
    <main className="pageContent" dir={isEnglish ? "ltr" : "rtl"} style={{ display: "grid", gap: 20 }}>
      <section className="lifestyle-card">
        <div className="lifestyle-title">{text.title}</div>
        <div className="lifestyle-muted">{text.subtitle}</div>
      </section>

      <section className="lifestyle-card">
        <form onSubmit={createArea} style={{ display: "grid", gap: 8 }}>
          <label className="label">{text.areaName}</label>
          <input className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder={text.areaPlaceholder} />
          <button className="wow-btn wow-btnPrimary" type="submit">{text.addArea}</button>
        </form>
      </section>

      {loading ? (
        <div className="wow-skeleton" style={{ height: 100 }} />
      ) : areas.length === 0 ? (
        <section className="lifestyle-card"><p className="wow-muted">{text.noAreas}</p></section>
      ) : (
        <>
          <section className="lifestyle-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAreaId(a.id)}
                className={`wow-btn ${selectedAreaId === a.id ? "wow-btnPrimary" : ""}`}
              >
                📦 {a.name}
              </button>
            ))}
          </section>

          <section className="lifestyle-card">
            <form onSubmit={createItem} style={{ display: "grid", gap: 8 }}>
              <label className="label">{text.itemName}</label>
              <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={text.itemPlaceholder} />
              <label className="label">{text.quantity}</label>
              <input className="input" type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value || 0))} />
              <label className="label">{text.photoUrl}</label>
              <input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
              <label className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={isDonated} onChange={(e) => setIsDonated(e.target.checked)} />
                {text.markDonated}
              </label>
              <button className="wow-btn wow-btnPrimary" type="submit">{text.addItem}</button>
            </form>
          </section>

          <section className="lifestyle-card" style={{ display: "grid", gap: 10 }}>
            {selectedItems.length === 0 ? (
              <p className="wow-muted">{text.noItems}</p>
            ) : (
              selectedItems.map((it) => (
                <article key={it.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{it.name} {it.is_donated ? "✅" : ""}</div>
                  <div className="wow-muted">{text.quantity}: {it.quantity}</div>
                  {it.photo_url && (
                    <img src={it.photo_url} alt={it.name} style={{ width: 120, marginTop: 8, borderRadius: 8 }} />
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
