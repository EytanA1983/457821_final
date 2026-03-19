import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { showSuccess, showError } from "../utils/toast";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";

export const AddTaskPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        created: "Task created successfully.",
        createFail: "We couldn't create the task.",
        title: "Add New Task",
        taskTitle: "Title:",
        taskPlaceholder: "Enter task title",
        dueDate: "Due date (optional):",
        forKid: "Task for child",
        childName: "Child name",
        childAge: "Child age",
        save: "Save task",
      }
    : {
        created: "המשימה נוצרה בהצלחה.",
        createFail: "לא הצלחנו ליצור את המשימה.",
        title: "הוספת משימה חדשה",
        taskTitle: "כותרת:",
        taskPlaceholder: "הזן כותרת למשימה",
        dueDate: "תאריך יעד (אופציונלי):",
        forKid: "משימה לילד/ה",
        childName: "שם הילד/ה",
        childAge: "גיל",
        save: "שמירת משימה",
      };
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isKidTask, setIsKidTask] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [assigneeAge, setAssigneeAge] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomIdParam = Number(searchParams.get("roomId"));
  const roomId = Number.isFinite(roomIdParam) && roomIdParam > 0 ? roomIdParam : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/tasks", {
        title,
        due_date: dueDate ? new Date(dueDate).toISOString().split("T")[0] : null,
        room_id: roomId,
        is_kid_task: isKidTask,
        assignee_name: assigneeName.trim() || null,
        assignee_age: assigneeAge ? Number(assigneeAge) : null,
      });
      showSuccess(t.created);
      navigate(ROUTES.HOME);
    } catch (err: any) {
      showError(err.response?.data?.detail ?? t.createFail);
    }
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 safe-top safe-bottom" dir={isEnglish ? "ltr" : "rtl"}>
      <form onSubmit={submit} className="max-w-md mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg mt-4">
        <h2 className="text-xl sm:text-2xl mb-6 font-bold">{t.title}</h2>

        <label className="block mb-4">
          <span className="block mb-2 text-sm font-medium">{t.taskTitle}</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full py-3 sm:py-2 text-base"
            placeholder={t.taskPlaceholder}
          />
        </label>

        <label className="block mb-6">
          <span className="block mb-2 text-sm font-medium">{t.dueDate}</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input w-full py-3 sm:py-2 text-base"
          />
        </label>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={isKidTask} onChange={(e) => setIsKidTask(e.target.checked)} />
          <span className="text-sm font-medium">{t.forKid}</span>
        </label>

        {isKidTask && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <label className="block">
              <span className="block mb-2 text-sm font-medium">{t.childName}</span>
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="input w-full py-3 sm:py-2 text-base"
                placeholder={isEnglish ? "e.g. Ben" : "לדוגמה: בן"}
              />
            </label>
            <label className="block">
              <span className="block mb-2 text-sm font-medium">{t.childAge}</span>
              <input
                type="number"
                min={1}
                max={18}
                value={assigneeAge}
                onChange={(e) => setAssigneeAge(e.target.value)}
                className="input w-full py-3 sm:py-2 text-base"
                placeholder="6"
              />
            </label>
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-sky w-full touch-target py-4 sm:py-3 text-base font-medium"
        >
          {t.save}
        </button>
      </form>
    </div>
  );
};
