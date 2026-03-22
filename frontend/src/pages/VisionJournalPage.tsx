/**
 * Vision Board — personal inspiration / journal (text + images), persisted per user on the API.
 * Daily quote rotates by calendar day (UTC bucket); personal lines optional in localStorage per user.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { VisionBoardModal } from "../components/VisionBoardModal";
import { ROUTES } from "../utils/routes";
import { baseLanguageCode, isRtlLang } from "../utils/localeDirection";
import { useAuth } from "../hooks/useAuth";
import { Modal } from "../components/Modal";
import api from "../api";
import type { VisionJournalEntryRead } from "../schemas/vision_journal";
import { publicStaticUrl } from "../utils/staticUrl";
import { getAccessToken } from "../utils/tokenStorage";
import { showError, showPromise } from "../utils/toast";

const STORAGE_QUOTES_PREFIX = "wow-vision-journal-quotes-v1";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const DEFAULT_QUOTES_HE = [
  "בית מסודר נותן מקום לנשימה.",
  "צעד קטן היום — שינוי גדול מחר.",
  "מה ששומרים עם אהבה — משרים אהבה.",
  "אור וסדר מזמינים שקט.",
  "כל מגירה שמסודרת היא מתנה לעצמך.",
  "היום בוחרים ניצחון קטן בבית.",
  "מקום אחד נקי משנה את כל האווירה.",
  "אין צורך בשלמות — רק בהתקדמות.",
  "הבית משקף את מה שחשוב לנו — נבחר בעדינות.",
  "רגע של סידור הוא רגע של טיפול עצמי.",
];

const DEFAULT_QUOTES_EN = [
  "A tidy home makes room to breathe.",
  "A small step today — a bigger change tomorrow.",
  "What we keep with love — spreads love.",
  "Light and order invite calm.",
  "Every organized drawer is a gift to yourself.",
  "Today, pick one small win at home.",
  "One clear corner shifts the whole mood.",
  "No need for perfection — only progress.",
  "Our home reflects what matters — choose gently.",
  "A moment of organizing is self-care.",
];

function visionUserId(user: unknown): number | null {
  if (!user || typeof user !== "object") return null;
  const id = (user as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const n = Number.parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dayBucketUtc(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export default function VisionJournalPage() {
  const { user } = useAuth();
  const uid = visionUserId(user);
  const quotesStorageKey = uid != null ? `${STORAGE_QUOTES_PREFIX}-u${uid}` : STORAGE_QUOTES_PREFIX;

  const { t, i18n } = useTranslation("visionSchedule");
  const { t: tToast } = useTranslation("toast");
  const { t: tCommon } = useTranslation("common");
  const isRtl = isRtlLang(i18n.language);
  const baseLang = baseLanguageCode(i18n.language);
  const visionApiLang = baseLang === "he" ? "he" : "en";
  const queryClient = useQueryClient();

  const [quotes, setQuotes] = useState<string[]>([]);
  const [quotesModalOpen, setQuotesModalOpen] = useState(false);
  const [quotesDraft, setQuotesDraft] = useState("");
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [visionModalOpen, setVisionModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = loadJson<string[]>(quotesStorageKey, []);
    setQuotes(Array.isArray(stored) ? stored.filter((q) => typeof q === "string" && q.trim()) : []);
  }, [quotesStorageKey]);

  const persistQuotes = useCallback(
    (next: string[]) => {
      setQuotes(next);
      saveJson(quotesStorageKey, next);
    },
    [quotesStorageKey],
  );

  const defaults = useMemo(
    () => (baseLang === "he" ? DEFAULT_QUOTES_HE : DEFAULT_QUOTES_EN),
    [baseLang],
  );

  const inspirationLine = useMemo(() => {
    const custom = quotes.map((q) => q.trim()).filter(Boolean);
    const pool = custom.length > 0 ? custom : defaults;
    if (!pool.length) return "";
    const idx = dayBucketUtc() % pool.length;
    return pool[idx] ?? "";
  }, [quotes, defaults]);

  const entriesQuery = useQuery({
    queryKey: ["vision-journal", "items", uid],
    queryFn: async () => {
      const { data } = await api.get<VisionJournalEntryRead[]>("/vision-journal/items", { params: { limit: 200 } });
      return Array.isArray(data) ? data : [];
    },
    enabled: uid != null && !!getAccessToken(),
    staleTime: 30_000,
  });

  const invalidateEntries = () => void queryClient.invalidateQueries({ queryKey: ["vision-journal", "items", uid] });

  const createTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post<VisionJournalEntryRead>("/vision-journal/items", {
        entry_type: "text",
        text_content: text,
      });
      return data;
    },
    onSuccess: () => invalidateEntries(),
    onError: () => showError(tToast("error_occurred")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/vision-journal/items/${id}`);
    },
    onSuccess: () => invalidateEntries(),
    onError: () => showError(tToast("error_occurred")),
  });

  const openQuotesEditor = () => {
    setQuotesDraft(quotes.length ? quotes.join("\n") : "");
    setQuotesModalOpen(true);
  };

  const saveQuotesFromModal = () => {
    const lines = quotesDraft
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    persistQuotes(lines);
    setQuotesModalOpen(false);
  };


  const addTextEntry = () => {
    const body = textDraft.trim();
    if (!body) return;
    const p = createTextMutation.mutateAsync(body);
    showPromise(p, {
      loading: tCommon("loading"),
      success: t("entrySaved"),
      error: tToast("error_occurred"),
    });
    void p
      .then(() => {
        setTextDraft("");
        setTextModalOpen(false);
      })
      .catch(() => {});
  };

  const uploadImageAndCreateEntry = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert(t("imageTooLarge", { maxMb: 5 }));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    const p = (async () => {
      const { data: up } = await api.post<{ url: string }>("/vision-journal/upload-image", form);
      if (!up?.url) throw new Error("no url");
      await api.post<VisionJournalEntryRead>("/vision-journal/items", {
        entry_type: "image",
        image_url: up.url,
      });
      invalidateEntries();
    })();
    showPromise(p, {
      loading: tCommon("loading"),
      success: t("entrySaved"),
      error: tToast("error_occurred"),
    });
    try {
      await p;
    } catch {
      /* toast via showPromise */
    }
  };

  const onPickImageFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void uploadImageAndCreateEntry(files[0]);
  };

  const removeEntry = (id: number) => {
    const p = deleteMutation.mutateAsync(id);
    showPromise(p, {
      loading: tToast("loading") || "…",
      success: t("removeCard"),
      error: tToast("error_occurred"),
    });
  };

  const entries = entriesQuery.data ?? [];
  const entriesLoading = entriesQuery.isLoading;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-amber-50/90 via-cream to-stone-100 dark:from-stone-950 dark:via-dark-bg dark:to-stone-900 p-4 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-center gap-3 opacity-80" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-rose-400 shadow" />
          <span className="h-3 w-3 rounded-full bg-sky-400 shadow" />
          <span className="h-3 w-3 rounded-full bg-amber-400 shadow" />
        </div>

        <div
          className="relative rounded-r-3xl rounded-l-xl border border-amber-200/80 dark:border-amber-900/40 bg-[#fffef7] dark:bg-[#1c1b16] shadow-2xl overflow-hidden"
          style={{
            boxShadow: "8px 16px 40px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.35)",
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-3 sm:w-4 bg-gradient-to-b from-amber-900/85 to-amber-950/90"
            aria-hidden
          />
          <div
            className="pl-5 sm:pl-8 pr-4 sm:pr-8 py-6 sm:py-8 space-y-6"
            style={{
              backgroundImage: `repeating-linear-gradient(
                transparent,
                transparent 27px,
                rgba(120, 113, 108, 0.08) 28px
              )`,
              backgroundSize: "100% 28px",
            }}
          >
            <div className="flex flex-col min-h-[min(70vh,720px)] gap-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif text-center sm:text-start">
                {t("pageTitle")}
              </h1>

              <header className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={ROUTES.CALENDAR}
                  className="text-sm font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:no-underline"
                >
                  {t("openGoogleJournal")}
                </Link>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="text-sm text-stone-600 dark:text-stone-400 underline" onClick={openQuotesEditor}>
                    {t("manageQuotes")}
                  </button>
                  {user ? (
                    <button
                      type="button"
                      className="text-sm text-stone-600 dark:text-stone-400 underline"
                      onClick={() => setVisionModalOpen(true)}
                    >
                      {t("editServerVision")}
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-white/70 dark:bg-stone-900/50 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80 font-semibold">
                  {t("inspirationLabel")}
                </p>
                <p className="mt-1 text-lg sm:text-xl text-stone-800 dark:text-stone-100 font-serif italic leading-relaxed">
                  {inspirationLine || t("inspirationFallback")}
                </p>
              </div>

              <section className="flex-1 min-h-0" aria-label={t("boardAria")}>
                {entriesLoading ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-600 p-8 text-center text-stone-500 dark:text-stone-400">
                    {tCommon("loading")}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-600 p-8 text-center text-stone-500 dark:text-stone-400">
                    {t("emptyJournal")}
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
                    {entries.map((entry, i) => (
                      <li
                        key={entry.id}
                        className="relative group"
                        style={{ transform: `rotate(${((i % 5) - 2) * 0.6}deg)` }}
                      >
                        {entry.entry_type === "text" ? (
                          <div className="rounded-xl bg-amber-50/95 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 shadow-lg p-4 min-h-[100px]">
                            <p className="text-stone-800 dark:text-stone-100 whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
                              {entry.text_content ?? ""}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-lg bg-white dark:bg-stone-900">
                            <img
                              src={publicStaticUrl(entry.image_url ?? "")}
                              alt={entry.caption ?? ""}
                              className="w-full h-48 object-cover"
                              loading="lazy"
                            />
                            {entry.caption ? (
                              <p className="text-xs text-stone-600 dark:text-stone-400 px-2 py-1">{entry.caption}</p>
                            ) : null}
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute top-2 end-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-stone-900/80 text-white"
                          onClick={() => removeEntry(entry.id)}
                        >
                          {t("removeCard")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <footer className="mt-auto pt-4 border-t border-amber-200/60 dark:border-amber-900/40">
                <p className="sr-only">{t("addActionsAria")}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <button type="button" className="wow-btn wow-btnPrimary" onClick={() => setTextModalOpen(true)}>
                    {t("addText")}
                  </button>
                  <button type="button" className="wow-btn wow-btnPrimary" onClick={() => fileInputRef.current?.click()}>
                    {t("addImage")}
                  </button>
                  <button type="button" className="wow-btn" onClick={() => cameraInputRef.current?.click()}>
                    {t("useCamera")}
                  </button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickImageFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPickImageFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {quotesModalOpen ? (
        <Modal onClose={() => setQuotesModalOpen(false)} title={t("quotesModalTitle")} description={null}>
          <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("quotesModalHelp")}</p>
            <textarea
              className="w-full min-h-[160px] rounded-xl border border-gray-200 dark:border-gray-600 p-3 text-sm bg-white dark:bg-dark-surface"
              value={quotesDraft}
              onChange={(e) => setQuotesDraft(e.target.value)}
              placeholder={t("quotesPlaceholder")}
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" className="wow-btn" onClick={() => setQuotesModalOpen(false)}>
                {tCommon("cancel")}
              </button>
              <button type="button" className="wow-btn wow-btnPrimary" onClick={saveQuotesFromModal}>
                {t("saveQuotes")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {textModalOpen ? (
        <Modal onClose={() => setTextModalOpen(false)} title={t("textModalTitle")} description={null}>
          <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-gray-200 dark:border-gray-600 p-3 text-sm bg-white dark:bg-dark-surface"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder={t("textPlaceholder")}
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" className="wow-btn" onClick={() => setTextModalOpen(false)}>
                {tCommon("cancel")}
              </button>
              <button type="button" className="wow-btn wow-btnPrimary" onClick={addTextEntry}>
                {t("saveText")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <VisionBoardModal isOpen={visionModalOpen} onClose={() => setVisionModalOpen(false)} apiLang={visionApiLang} />
    </div>
  );
}
