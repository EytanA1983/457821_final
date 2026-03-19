import { PremiumTaskItem } from "./PremiumTaskItem";
import type { PremiumTask } from "./PremiumTaskItem";
import { useTranslation } from "react-i18next";

export function PremiumTaskList({
  tasks,
  onToggle,
}: {
  tasks: PremiumTask[];
  onToggle: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        emptyTitle: "No tasks here yet",
        emptyHint: "Perfect time to pick another room - or add one tiny task for a big calm shift.",
      }
    : {
        emptyTitle: "אין משימות כאן כרגע",
        emptyHint: "זה זמן מושלם לבחור חדר אחר — או להוסיף משימה קטנה שתעשה שקט גדול.",
      };

  if (!tasks.length) {
    return (
      <div className="emptyState">
        <div className="emptyTitle">{text.emptyTitle}</div>
        <div>{text.emptyHint}</div>
      </div>
    );
  }

  return (
    <div className="taskList">
      {tasks.map((t) => (
        <PremiumTaskItem key={t.id} task={t} onToggle={onToggle} />
      ))}
    </div>
  );
}

export type { PremiumTask };
