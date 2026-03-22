import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { InventoryAreaRead, InventoryItemRead } from "../schemas/inventory";
import { showError, showSuccess } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../utils/routes";
import { isRtlLang } from "../utils/localeDirection";
import { inventoryPhotoSrc } from "../utils/inventoryImageUrl";

export default function InventoryPage() {
  const { t } = useTranslation("inventory");
  const { t: tl } = useTranslation("layout");
  const { t: tCommon } = useTranslation("common");
  const { i18n } = useTranslation();
  const dirAttr = isRtlLang(i18n.language) ? "rtl" : "ltr";

  const [items, setItems] = useState<InventoryItemRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [primaryAreaId, setPrimaryAreaId] = useState<number | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [itemDescription, setItemDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isDonated, setIsDonated] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBootstrapError(false);
    try {
      const { data: itemsData } = await api.get<InventoryItemRead[]>("/inventory/items");
      let { data: areasData } = await api.get<InventoryAreaRead[]>("/inventory/areas");
      let list = areasData || [];

      if (list.length === 0) {
        const { data: created } = await api.post<InventoryAreaRead>("/inventory/areas", {
          name: t("defaultInventoryAreaName"),
        });
        list = [created];
      }

      const defaultName = t("defaultInventoryAreaName").trim();
      const preferred = list.find((a) => a.name.trim() === defaultName) ?? list[0];
      setPrimaryAreaId(preferred?.id ?? null);
      setItems(itemsData || []);
    } catch {
      setItems([]);
      setPrimaryAreaId(null);
      setBootstrapError(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePhotoFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError(t("photoUploadTypeError"));
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ url: string }>("/inventory/upload-photo", fd);
      if (data?.url) {
        setPhotoUrl(data.url);
        showSuccess(t("photoUploadSuccess"));
      }
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      showError(typeof detail === "string" ? detail : t("photoUploadFailed"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const openFilePicker = (mode: "gallery" | "camera") => {
    const el = fileInputRef.current;
    if (!el) return;
    if (mode === "camera") {
      el.setAttribute("capture", "environment");
    } else {
      el.removeAttribute("capture");
    }
    el.click();
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    e.target.removeAttribute("capture");
    await handlePhotoFile(f);
  };

  const resetForm = () => {
    setItemDescription("");
    setPhotoUrl("");
    setIsDonated(false);
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = itemDescription.trim();
    if (!trimmed || primaryAreaId == null) return;
    setSavingItem(true);
    try {
      const { data } = await api.post<InventoryItemRead>("/inventory/items", {
        area_id: primaryAreaId,
        name: trimmed,
        quantity: 1,
        photo_url: photoUrl.trim() || null,
        is_donated: isDonated,
      });
      setItems((prev) => [data, ...prev]);
      resetForm();
      setAddFormOpen(false);
      showSuccess(t("itemAdded"));
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      showError(detail ?? t("itemAddFailed"));
    } finally {
      setSavingItem(false);
    }
  };

  const previewSrc = inventoryPhotoSrc(photoUrl);

  return (
    <main className="pageContent" dir={dirAttr} style={{ display: "grid", gap: 20 }}>
      <section className="lifestyle-card">
        <div className="lifestyle-title">{t("title")}</div>
        <div className="lifestyle-muted">{t("subtitle")}</div>
        <p className="wow-muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {tl("inventoryKicker")}{" "}
          <Link to={ROUTES.CATEGORIES} className="wow-btn" style={{ display: "inline-flex", padding: "2px 10px", fontSize: "0.85rem" }}>
            {tl("inventoryBackCategories")}
          </Link>
        </p>
      </section>

      {loading ? (
        <div className="wow-skeleton" style={{ height: 100 }} />
      ) : bootstrapError ? (
        <section className="lifestyle-card">
          <p className="wow-muted">{t("bootstrapError")}</p>
          <button type="button" className="wow-btn wow-btnPrimary" style={{ marginTop: 12 }} onClick={() => void load()}>
            {t("retryLoad")}
          </button>
        </section>
      ) : (
        <>
          <section className="lifestyle-card" style={{ display: "grid", gap: 12 }}>
            {!addFormOpen ? (
              <button type="button" className="wow-btn wow-btnPrimary touch-target" onClick={() => setAddFormOpen(true)}>
                {t("addItemToggleCta")}
              </button>
            ) : (
              <form onSubmit={(e) => void createItem(e)} style={{ display: "grid", gap: 10 }}>
                <div className="lifestyle-title" style={{ fontSize: 18 }}>
                  {t("addItemFormTitle")}
                </div>
                <p className="lifestyle-muted" style={{ margin: 0 }}>
                  {t("addItemFormHint")}
                </p>

                <label className="label" htmlFor="inventory-item-desc">
                  {t("itemDescriptionLabel")}
                </label>
                <textarea
                  id="inventory-item-desc"
                  className="input"
                  rows={4}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder={t("itemDescriptionPlaceholder")}
                  dir={dirAttr}
                  maxLength={200}
                  disabled={savingItem}
                />

                <div style={{ marginTop: 4 }}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    {t("photoSectionTitle")}
                  </div>
                  <p className="wow-muted" style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>
                    {t("photoOptionalHint")}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
                    aria-hidden
                    tabIndex={-1}
                    onChange={onFileInputChange}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      className="wow-btn touch-target"
                      disabled={photoUploading || savingItem}
                      onClick={() => openFilePicker("gallery")}
                    >
                      {photoUploading ? t("photoUploading") : t("photoUploadFromDevice")}
                    </button>
                    <button
                      type="button"
                      className="wow-btn touch-target"
                      disabled={photoUploading || savingItem}
                      onClick={() => openFilePicker("camera")}
                    >
                      {t("photoUseCamera")}
                    </button>
                    {photoUrl ? (
                      <button type="button" className="wow-btn" disabled={savingItem} onClick={() => setPhotoUrl("")}>
                        {t("photoClear")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {previewSrc ? (
                  <div style={{ marginTop: 4 }}>
                    <img
                      src={previewSrc}
                      alt=""
                      style={{ maxWidth: "min(100%, 280px)", maxHeight: 220, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)" }}
                    />
                  </div>
                ) : null}

                <label className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={isDonated} disabled={savingItem} onChange={(e) => setIsDonated(e.target.checked)} />
                  {t("markDonated")}
                </label>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <button className="wow-btn wow-btnPrimary" type="submit" disabled={savingItem || !itemDescription.trim()}>
                    {savingItem ? tCommon("loading") : t("addItem")}
                  </button>
                  <button
                    type="button"
                    className="wow-btn"
                    disabled={savingItem}
                    onClick={() => {
                      resetForm();
                      setAddFormOpen(false);
                    }}
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="lifestyle-card" style={{ display: "grid", gap: 10 }}>
            <div className="lifestyle-title" style={{ fontSize: 18 }}>
              {t("itemsListTitle")}
            </div>
            {items.length === 0 ? (
              <p className="wow-muted">{t("noItems")}</p>
            ) : (
              items.map((it) => (
                <article key={it.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>
                    {it.name} {it.is_donated ? "✅" : ""}
                  </div>
                  {it.photo_url ? (
                    <img
                      src={inventoryPhotoSrc(it.photo_url)}
                      alt={it.name}
                      style={{ width: 120, marginTop: 8, borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : null}
                </article>
              ))
            )}
          </section>
        </>
      )}

    </main>
  );
}
