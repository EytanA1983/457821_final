import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AxiosError } from "axios";
import api from "../api";
import { invalidateTasksAndProgressCaches } from "../api/dashboardBootstrap";
import { TaskRead } from "../schemas/task";
import { showSuccess, showError } from "../utils/toast";
import { TaskSkeleton } from "../components/SkeletonLoader";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";
import { intlLocaleForLang, isRtlLang } from "../utils/localeDirection";

/**
 * AllTasksPage — all tasks across rooms
 */
export const AllTasksPage = () => {
  const { i18n } = useTranslation();
  const { t } = useTranslation("tasks");
  const dirAttr = isRtlLang(i18n.language) ? "rtl" : "ltr";
  const locale = intlLocaleForLang(i18n.language);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, refetch } = useQuery<TaskRead[]>({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const response = await api.get<TaskRead[]>("/tasks");
      return response.data;
    },
  });

  const handleCompleteTask = async (taskId: number) => {
    try {
      await api.patch(`/tasks/${taskId}`, { completed: true });
      await invalidateTasksAndProgressCaches(queryClient);
      showSuccess(t("all_list_toast_done"));
      refetch();
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      showError(axiosError.response?.data?.detail ?? t("all_list_toast_update_fail"));
    }
  };

  const handleAttachImage = async (task: TaskRead, kind: "before" | "after") => {
    const promptLabel = kind === "before" ? t("all_list_image_prompt_before") : t("all_list_image_prompt_after");
    const currentValue = kind === "before" ? (task.before_image_url || "") : (task.after_image_url || "");
    const value = window.prompt(promptLabel, currentValue);
    if (value === null) return;
    try {
      await api.patch(`/tasks/${task.id}`, {
        ...(kind === "before" ? { before_image_url: value || null } : { after_image_url: value || null }),
      });
      await invalidateTasksAndProgressCaches(queryClient);
      showSuccess(t("all_list_image_updated"));
      refetch();
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      showError(axiosError.response?.data?.detail ?? t("all_list_image_failed"));
    }
  };

  const completedTasks = tasks.filter((x) => x.completed);
  const pendingTasks = tasks.filter((x) => !x.completed);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 safe-bottom" dir={dirAttr}>
      <main className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">{t("all_list_page_title")}</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
              {t("all_list_summary", { all: tasks.length, pending: pendingTasks.length, completed: completedTasks.length })}
            </p>
          </div>

          {isLoading ? (
            <TaskSkeleton count={6} />
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg px-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">{t("all_list_no_tasks_title")}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{t("all_list_no_tasks_sub")}</p>
              <Link to={ROUTES.ADD_TASK} className="btn btn-sky touch-target inline-flex items-center justify-center gap-2 px-6 py-3">
                <span className="emoji">➕</span>
                {t("all_list_add_first")}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingTasks.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                    {t("pending")} ({pendingTasks.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex-1">
                            {task.title}
                            {task.is_kid_task && (
                              <span className="wow-chip wow-chipAccent" style={{ marginInlineStart: 8 }}>
                                {t("all_list_child_task")}
                                {task.assignee_name ? ` • ${task.assignee_name}` : ""}
                                {task.assignee_age ? ` (${task.assignee_age})` : ""}
                              </span>
                            )}
                          </h3>
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="ms-2 p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg touch-target"
                            title={t("all_list_mark_done")}
                            type="button"
                          >
                            ✓
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex gap-2 mb-3">
                          <button type="button" className="wow-btn" onClick={() => handleAttachImage(task, "before")}>
                            {t("all_list_before")}
                          </button>
                          <button type="button" className="wow-btn" onClick={() => handleAttachImage(task, "after")}>
                            {t("all_list_after")}
                          </button>
                        </div>

                        {(task.before_image_url || task.after_image_url) && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {task.before_image_url ? (
                              <img src={task.before_image_url} alt={t("all_list_before")} className="w-full h-20 object-cover rounded-md" />
                            ) : (
                              <div className="wow-skeleton" style={{ height: 80 }} />
                            )}
                            {task.after_image_url ? (
                              <img src={task.after_image_url} alt={t("all_list_after")} className="w-full h-20 object-cover rounded-md" />
                            ) : (
                              <div className="wow-skeleton" style={{ height: 80 }} />
                            )}
                          </div>
                        )}

                        {task.due_date && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{t("all_list_date_label")}</span>
                            <span>
                              {new Date(task.due_date).toLocaleDateString(locale, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedTasks.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                    {t("completed")} ({completedTasks.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedTasks.map((task) => (
                      <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 opacity-75">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 line-through flex-1">
                            {task.title}
                            {task.is_kid_task && (
                              <span className="wow-chip wow-chipAccent" style={{ marginInlineStart: 8 }}>
                                {t("all_list_child_task")}
                                {task.assignee_name ? ` • ${task.assignee_name}` : ""}
                                {task.assignee_age ? ` (${task.assignee_age})` : ""}
                              </span>
                            )}
                          </h3>
                          <span className="text-green-600 dark:text-green-400 text-sm font-medium">✅</span>
                        </div>

                        {task.description && <p className="text-gray-500 dark:text-gray-500 text-sm line-clamp-2">{task.description}</p>}

                        {(task.before_image_url || task.after_image_url) && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {task.before_image_url ? (
                              <img src={task.before_image_url} alt={t("all_list_before")} className="w-full h-20 object-cover rounded-md" />
                            ) : (
                              <div className="wow-skeleton" style={{ height: 80 }} />
                            )}
                            {task.after_image_url ? (
                              <img src={task.after_image_url} alt={t("all_list_after")} className="w-full h-20 object-cover rounded-md" />
                            ) : (
                              <div className="wow-skeleton" style={{ height: 80 }} />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AllTasksPage;
