import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRooms } from "../hooks/useRooms";
import { RoomCardSkeleton } from "../components/SkeletonLoader";
import { useTranslation } from "react-i18next";
import api from "../api";
import { showError, showSuccess } from "../utils/toast";
import { isRtlLang } from "../utils/localeDirection";
import {
  PRODUCT_CATEGORY_NAV_ORDER,
  type ProductCategoryKey,
  getProductCategoryEmoji,
  findLegacyRoomForProductCategory,
} from "../domain/productCategories";
import { getCategoryRoute } from "../utils/routes";
import { getLocalizedRoomTitle } from "../utils/roomLocalization";
import { invalidateTasksAndProgressCaches } from "../api/dashboardBootstrap";
import { nextFirstOfMonthDueIsoLocal } from "../utils/categoryQuickTaskDueDate";

type QuickTaskMode = "daily" | "monthly";

export const CategoriesPage = () => {
  const queryClient = useQueryClient();
  const { i18n, t: tPc } = useTranslation("productCategories");
  const { t: tRoomsNs } = useTranslation("rooms");
  const { t: tCommon } = useTranslation("common");
  const { t: tToast } = useTranslation("toast");
  const rtl = isRtlLang(i18n.language);
  const { data: rooms = [], isLoading: loading, refetch } = useRooms();
  const [newAreaName, setNewAreaName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addAreaOpen, setAddAreaOpen] = useState(false);

  const [quickTitle, setQuickTitle] = useState("");
  const [quickMode, setQuickMode] = useState<QuickTaskMode>("daily");
  const [quickSaving, setQuickSaving] = useState(false);

  /** Native tooltip (hover) — full former card copy without cluttering the layout. */
  const addAreaHoverTitle = useMemo(
    () =>
      [
        tPc("hub.createAreaTitle"),
        tPc("hub.createAreaSub"),
        `${tPc("hub.areaNameLabel")}: ${tPc("hub.areaNamePlaceholder")}`,
      ].join("\n\n"),
    [tPc],
  );

  const handleCreateArea = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newAreaName.trim();
    if (!name) {
      showError(tRoomsNs("hub.roomRequired"));
      return;
    }

    setCreating(true);
    try {
      await api.post("/rooms", { name });
      setNewAreaName("");
      setAddAreaOpen(false);
      showSuccess(tRoomsNs("hub.createSuccess"));
      await refetch();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: { data?: { detail?: string } } };
      const isNetworkError =
        err?.code === "ERR_NETWORK" ||
        err?.code === "ERR_FAILED" ||
        err?.message?.includes("Network Error") ||
        err?.message?.includes("Failed");

      if (isNetworkError) {
        showError(tRoomsNs("hub.networkError"));
      } else {
        showError(err?.response?.data?.detail ?? tRoomsNs("hub.createFail"));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleQuickTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) {
      showError(tPc("hub.quickTaskTitleRequired"));
      return;
    }
    setQuickSaving(true);
    try {
      if (quickMode === "daily") {
        await api.post("/tasks", {
          title,
          recurrence: "daily",
          due_date: null,
        });
      } else {
        await api.post("/tasks", {
          title,
          recurrence: "monthly",
          due_date: nextFirstOfMonthDueIsoLocal(9, 0),
        });
      }
      await invalidateTasksAndProgressCaches(queryClient);
      setQuickTitle("");
      showSuccess(tToast("task_created"));
    } catch (error: unknown) {
      const detail =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      showError(detail ?? tToast("task_creation_failed"));
    } finally {
      setQuickSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pageBg pageBg--room" dir={rtl ? "rtl" : "ltr"}>
        <div className="pageOverlay" />
        <div className="pageContent">
          <h1 className="text-2xl font-bold mb-4">
            {tPc("hub.pageTitle")} — {tCommon("loading")}
          </h1>
          <RoomCardSkeleton count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="pageBg pageBg--room" dir={rtl ? "rtl" : "ltr"}>
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>
        <div className="lifestyle-card">
          <div className="lifestyle-title">{tPc("hub.pageTitle")}</div>
          <div className="lifestyle-muted">{tPc("hub.pageSubtitle")}</div>
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="categories-add-area-trigger"
              title={addAreaHoverTitle}
              aria-label={addAreaHoverTitle}
              aria-expanded={addAreaOpen}
              onClick={() => setAddAreaOpen((open) => !open)}
            >
              {tPc("hub.addAreaMinimalCta")}
            </button>
          </div>

          {addAreaOpen ? (
            <form className="categories-add-area-form" style={{ marginTop: 12 }} onSubmit={handleCreateArea}>
              <input
                className="input"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder={tPc("hub.areaNamePlaceholder")}
                aria-label={tPc("hub.areaNameLabel")}
                disabled={creating}
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="wow-btn wow-btnPrimary" disabled={creating}>
                {creating ? tRoomsNs("hub.creating") : tPc("hub.createAreaBtn")}
              </button>
              <button
                type="button"
                className="wow-btn wow-btn--ghost"
                disabled={creating}
                onClick={() => {
                  setAddAreaOpen(false);
                  setNewAreaName("");
                }}
              >
                {tCommon("cancel")}
              </button>
            </form>
          ) : null}
        </div>

        <div className="lifestyle-card">
          <div className="lifestyle-title">{tPc("hub.browseTitle")}</div>
          <div className="lifestyle-muted" style={{ marginBottom: 16 }}>
            {tPc("hub.browseSub")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {PRODUCT_CATEGORY_NAV_ORDER.map((key: ProductCategoryKey) => {
              const linked = findLegacyRoomForProductCategory(rooms, key);
              const categoryLabel = tPc(`items.${key}`);
              const linkedDisplay = linked
                ? getLocalizedRoomTitle(linked.name, tRoomsNs, { roomId: linked.id })
                : null;
              return (
                <Link
                  key={key}
                  to={getCategoryRoute(key)}
                  className="lifestyle-card wow-fadeIn"
                  aria-label={tPc("hub.openCategoryAria", { name: categoryLabel })}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="lifestyle-title" style={{ fontSize: 18 }}>
                    {getProductCategoryEmoji(key)} {categoryLabel}
                  </div>
                  <div className="wow-muted" style={{ fontSize: 13, marginTop: 8 }}>
                    {linkedDisplay
                      ? tPc("hub.linkedToArea", { name: linkedDisplay })
                      : tPc("hub.notLinked")}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="lifestyle-card">
          <div className="lifestyle-title">{tPc("hub.quickTaskTitle")}</div>
          <form onSubmit={(e) => void handleQuickTaskSubmit(e)} className="categories-quick-task-form" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={tPc("hub.quickTaskPlaceholder")}
              aria-label={tPc("hub.quickTaskPlaceholder")}
              disabled={quickSaving}
              autoComplete="off"
              maxLength={120}
            />
            <div className="categories-quick-task-mode" role="group" aria-label={tPc("hub.quickTaskModeAria")}>
              <button
                type="button"
                className={`categories-quick-task-mode__btn${quickMode === "daily" ? " categories-quick-task-mode__btn--active" : ""}`}
                onClick={() => setQuickMode("daily")}
                disabled={quickSaving}
                title={tPc("hub.quickTaskDailyHint")}
                aria-label={`${tPc("hub.quickTaskDaily")}: ${tPc("hub.quickTaskDailyHint")}`}
              >
                {tPc("hub.quickTaskDaily")}
              </button>
              <button
                type="button"
                className={`categories-quick-task-mode__btn${quickMode === "monthly" ? " categories-quick-task-mode__btn--active" : ""}`}
                onClick={() => setQuickMode("monthly")}
                disabled={quickSaving}
                title={tPc("hub.quickTaskMonthlyHint")}
                aria-label={`${tPc("hub.quickTaskMonthly")}: ${tPc("hub.quickTaskMonthlyHint")}`}
              >
                {tPc("hub.quickTaskMonthly")}
              </button>
            </div>
            <button type="submit" className="wow-btn wow-btnPrimary categories-quick-task-submit" disabled={quickSaving}>
              {quickSaving ? tToast("creating_task") : tPc("hub.quickTaskSave")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
