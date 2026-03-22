import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { showError } from "../utils/toast";
import { invalidateTasksAndProgressCaches } from "../api/dashboardBootstrap";
import { useTranslation } from "react-i18next";
import { useRooms } from "../hooks/useRooms";
import { useTasks } from "../hooks/useTasks";
import { ROUTES } from "../utils/routes";
import { isRtlLang } from "../utils/localeDirection";
import { getLocalizedRoomTitle, inferRoomCategory } from "../utils/roomLocalization";
import type { TaskRead } from "../schemas/task";
import {
  findLegacyRoomForProductCategory,
  getProductCategoryEmoji,
  isProductCategoryKey,
  type ProductCategoryKey,
} from "../domain/productCategories";
import {
  getTaskLibraryTitle,
  getTasksByCategory,
  type TaskLibraryItem,
} from "../data/taskLibrary";

type RecommendedVideo = {
  videoId: string | null;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
};

/**
 * Per-category YouTube clips (watch URL → embed id). Keep `embeddedVideoUrl` in sync here so
 * the iframe never briefly shows a stale/default video while `recommendedVideo` catches up.
 */
const CATEGORY_FIXED_YOUTUBE_VIDEO_IDS: Partial<Record<ProductCategoryKey, string>> = {
  kitchen: "GvknJunh7ro",
  bathroom_beauty: "G20k6mG5zPU",
  kids_toys_games: "BlyrFNg1H2M",
  clothes: "Vxwjd2fCPLw",
};

function fixedYoutubeIdForCategory(key: ProductCategoryKey | null): string | null {
  if (!key) return null;
  return CATEGORY_FIXED_YOUTUBE_VIDEO_IDS[key] ?? null;
}

type RoomTask = {
  id: number;
  title: string;
  completed: boolean;
};

/**
 * Category detail — UI uses canonical category keys; tasks still load via legacy `room_id` when mappable.
 */
export default function CategoryDetailPage() {
  const { i18n, t: tRoom } = useTranslation("room");
  const { t: tRooms } = useTranslation("rooms");
  const { t: tPc } = useTranslation("productCategories");
  const rtl = isRtlLang(i18n.language);
  const videoLang = (i18n.language || "he").split("-")[0] === "he" ? "he" : "en";
  const { categoryKey: categoryKeyRaw } = useParams<{ categoryKey: string }>();
  const categoryKey = categoryKeyRaw as ProductCategoryKey | undefined;
  const validKey = categoryKey && isProductCategoryKey(categoryKey) ? categoryKey : null;
  const fixedYoutubeId = fixedYoutubeIdForCategory(validKey);

  const queryClient = useQueryClient();
  const { data: rooms = [] } = useRooms();
  const linkedRoom = useMemo(() => {
    if (!validKey) return null;
    return findLegacyRoomForProductCategory(rooms, validKey);
  }, [rooms, validKey]);

  const roomIdNum = linkedRoom?.id ?? 0;
  const hasLinkedRoom = Boolean(linkedRoom && roomIdNum > 0);

  const {
    data: tasksData = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useTasks({ roomId: roomIdNum || undefined }, { enabled: hasLinkedRoom });

  const [recommendedVideo, setRecommendedVideo] = useState<RecommendedVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const displayTitle = validKey
    ? `${getProductCategoryEmoji(validKey)} ${tPc(`items.${validKey}`)}`
    : tPc("detail.invalidTitle");

  const linkedLabel = linkedRoom
    ? getLocalizedRoomTitle(linkedRoom.name, tRooms, { roomId: linkedRoom.id })
    : null;

  const roomTip = useMemo(() => {
    const cat = inferRoomCategory(linkedRoom?.name || "");
    if (cat === "kitchen") return tRoom("tip_kitchen");
    if (cat === "bedroom") return tRoom("tip_bedroom");
    if (cat === "living") return tRoom("tip_living");
    return tRoom("tip_default");
  }, [linkedRoom?.name, tRoom]);

  const tasks = useMemo<RoomTask[]>(() => {
    return (tasksData as TaskRead[])
      .map((task) => ({
        id: Number(task.id),
        title: task.title || tPc("detail.emptyTaskFallbackTitle"),
        completed: Boolean(task.completed),
      }))
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [tasksData, tPc]);

  const completedCount = tasks.filter((task) => task.completed).length;

  const taskLibrarySlices = useMemo(() => {
    if (!validKey) return { daily: [] as TaskLibraryItem[], monthly: [] as TaskLibraryItem[] };
    const all = getTasksByCategory(validKey);
    return {
      daily: all.filter((i) => i.frequency === "daily"),
      monthly: all.filter((i) => i.frequency === "monthly"),
    };
  }, [validKey]);

  const libraryLang = (i18n.language || "he").split("-")[0] || "he";

  const addTaskHrefForLibraryItem = (item: TaskLibraryItem): string => {
    const title = getTaskLibraryTitle(item, libraryLang);
    const q = new URLSearchParams();
    q.set("title", title);
    if (hasLinkedRoom && roomIdNum > 0) q.set("roomId", String(roomIdNum));
    return `${ROUTES.ADD_TASK}?${q.toString()}`;
  };

  const youtubeWatchUrl = fixedYoutubeId
    ? `https://www.youtube.com/watch?v=${fixedYoutubeId}`
    : recommendedVideo?.url || "https://www.youtube.com/@EliMaor555";

  const embeddedVideoUrl = useMemo(() => {
    if (fixedYoutubeId) {
      return `https://www.youtube.com/embed/${fixedYoutubeId}`;
    }
    if (recommendedVideo?.videoId) {
      return `https://www.youtube.com/embed/${recommendedVideo.videoId}`;
    }
    if (recommendedVideo?.url) {
      const match = recommendedVideo.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
      if (match?.[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    return "https://www.youtube.com/embed/BM5vN7ekfA8";
  }, [fixedYoutubeId, recommendedVideo]);

  useEffect(() => {
    const fixedId = fixedYoutubeIdForCategory(validKey);
    if (fixedId) {
      setVideoLoading(false);
      setRecommendedVideo({
        videoId: fixedId,
        title: null,
        url: `https://www.youtube.com/watch?v=${fixedId}`,
        thumbnail: null,
      });
      return;
    }

    if (!hasLinkedRoom || !roomIdNum) {
      setRecommendedVideo(null);
      setVideoLoading(false);
      return;
    }

    let isMounted = true;
    setVideoLoading(true);
    setRecommendedVideo(null);
    api
      .get<RecommendedVideo>("/content/recommended-video", {
        params: { room_id: roomIdNum, lang: videoLang },
      })
      .then(({ data }) => {
        if (!isMounted) return;
        setRecommendedVideo(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setRecommendedVideo(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setVideoLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasLinkedRoom, roomIdNum, videoLang, validKey]);

  const toggleTask = async (task: RoomTask) => {
    if (!task?.id || updatingTaskId) return;
    setUpdatingTaskId(task.id);
    try {
      await api.put(`/tasks/${task.id}`, { completed: !task.completed });
      await invalidateTasksAndProgressCaches(queryClient);
      await refetchTasks();
    } catch {
      showError(tPc("detail.taskToggleFailed"));
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (validKey === "emotional") {
    return <Navigate to={ROUTES.CATEGORIES} replace />;
  }

  if (!validKey) {
    return (
      <div className="pageBg pageBg--room" dir={rtl ? "rtl" : "ltr"}>
        <div className="pageOverlay" />
        <main className="pageContent" style={{ display: "grid", gap: 24 }}>
          <div className="lifestyle-card">
            <div className="lifestyle-title">{tPc("detail.invalidTitle")}</div>
            <div className="lifestyle-muted">{tPc("detail.invalidBody")}</div>
            <div style={{ marginTop: 12 }}>
              <Link className="wow-btn" to={ROUTES.CATEGORIES}>
                {tPc("hub.backToList")}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="pageBg pageBg--room" dir={rtl ? "rtl" : "ltr"}>
      <div className="pageOverlay" />
      <main className="pageContent" style={{ display: "grid", gap: 24 }}>
        <div className="lifestyle-card">
          <div className="lifestyle-title">{displayTitle}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="wow-btn" to={ROUTES.CATEGORIES}>
              {tPc("hub.backToList")}
            </Link>
            {hasLinkedRoom && (
              <Link className="wow-btn wow-btnPrimary" to={`${ROUTES.ADD_TASK}?roomId=${roomIdNum}`}>
                {tPc("detail.addTaskCta")}
              </Link>
            )}
          </div>
          <div className="lifestyle-muted">
            {linkedLabel ? tPc("detail.linkedLine", { name: linkedLabel }) : tPc("detail.unlinkedLine")}
            {hasLinkedRoom && tasks.length > 0
              ? ` · ${tPc("detail.tasksProgress", { completed: completedCount, total: tasks.length })}`
              : ""}
          </div>
        </div>

        {!hasLinkedRoom ? (
          <div className="lifestyle-card">
            <div className="lifestyle-title">{tPc("detail.noLinkTitle")}</div>
            <div className="lifestyle-muted">{tPc("detail.noLinkBody")}</div>
            <div style={{ marginTop: 12 }}>
              <Link className="wow-btn wow-btnPrimary" to={ROUTES.CATEGORIES}>
                {tPc("detail.noLinkCta")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="lifestyle-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div className="lifestyle-title">{tRoom("tasksTitle")}</div>
              <Link className="wow-btn wow-btnPrimary" to={`${ROUTES.ADD_TASK}?roomId=${roomIdNum}`}>
                {tRoom("addTask")}
              </Link>
            </div>

            {tasksLoading ? (
              <div className="lifestyle-muted">{tRoom("tasksLoading")}</div>
            ) : tasks.length === 0 ? (
              <div className="lifestyle-muted">
                {tRoom("noTasks")}
                <br />
                {tRoom("noTasksHint")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="wow-btn"
                    onClick={() => void toggleTask(task)}
                    disabled={updatingTaskId === task.id}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      opacity: updatingTaskId === task.id ? 0.75 : 1,
                      textDecoration: task.completed ? "line-through" : "none",
                    }}
                  >
                    {task.completed ? "✔ " : "○ "} {task.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lifestyle-card">
          <div className="lifestyle-title">{tPc("detail.taskLibraryTitle")}</div>
          <div className="lifestyle-muted">{tPc("detail.taskLibrarySubtitle")}</div>

          {taskLibrarySlices.daily.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div className="lifestyle-muted" style={{ fontWeight: 800, marginBottom: 8 }}>
                {tPc("detail.taskLibraryDaily")}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {taskLibrarySlices.daily.map((item) => (
                  <Link
                    key={item.id}
                    className="wow-btn"
                    to={addTaskHrefForLibraryItem(item)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: "space-between",
                      textAlign: rtl ? "right" : "left",
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      {getTaskLibraryTitle(item, libraryLang)}
                      {item.isCore ? (
                        <span className="lifestyle-muted" style={{ marginInlineStart: 8, fontSize: 12 }}>
                          ({tPc("detail.taskLibraryCoreBadge")})
                        </span>
                      ) : null}
                    </span>
                    {item.estimatedMinutes != null ? (
                      <span className="lifestyle-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {tPc("detail.taskLibraryMinutes", { minutes: item.estimatedMinutes })}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {taskLibrarySlices.monthly.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div className="lifestyle-muted" style={{ fontWeight: 800, marginBottom: 8 }}>
                {tPc("detail.taskLibraryMonthly")}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {taskLibrarySlices.monthly.map((item) => (
                  <Link
                    key={item.id}
                    className="wow-btn"
                    to={addTaskHrefForLibraryItem(item)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: "space-between",
                      textAlign: rtl ? "right" : "left",
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      {getTaskLibraryTitle(item, libraryLang)}
                      {item.isCore ? (
                        <span className="lifestyle-muted" style={{ marginInlineStart: 8, fontSize: 12 }}>
                          ({tPc("detail.taskLibraryCoreBadge")})
                        </span>
                      ) : null}
                    </span>
                    {item.estimatedMinutes != null ? (
                      <span className="lifestyle-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {tPc("detail.taskLibraryMinutes", { minutes: item.estimatedMinutes })}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lifestyle-card">
          <div className="lifestyle-title">{tPc("detail.coachTipTitle")}</div>
          <div className="lifestyle-muted">{roomTip}</div>
        </div>

        {(fixedYoutubeId || hasLinkedRoom) && (
          <div className="lifestyle-card" dir={rtl ? "rtl" : "ltr"}>
            <div className="lifestyle-title">{tPc("detail.videoTitle")}</div>
            <div className="lifestyle-muted" style={{ marginBottom: 12 }}>
              {hasLinkedRoom ? tPc("detail.videoSubLinked") : tPc("detail.videoSubCategory")}
            </div>

            {videoLoading && !fixedYoutubeId ? (
              <div className="wow-skeleton" style={{ height: 180, borderRadius: 16 }} />
            ) : (
              <iframe
                title={
                  validKey === "kitchen"
                    ? tPc("detail.videoIframeKitchen")
                    : validKey === "bathroom_beauty"
                      ? tPc("detail.videoIframeBathroom")
                      : validKey === "kids_toys_games"
                        ? tPc("detail.videoIframeKids")
                        : validKey === "clothes"
                          ? tPc("detail.videoIframeClothes")
                          : recommendedVideo?.title || tPc("detail.videoIframeDefault")
                }
                src={embeddedVideoUrl}
                className="inspiration-embed"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            )}

            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noreferrer"
              className="wow-btn"
              style={{ display: "inline-flex", marginTop: 10 }}
            >
              {fixedYoutubeId ? tPc("detail.watchOnYoutube") : tPc("detail.openChannel")}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
