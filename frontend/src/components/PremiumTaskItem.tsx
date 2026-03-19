type PremiumTask = {
  id: string;
  title: string;
  completed: boolean;
  room_id?: string;
  scope?: "today" | "week" | string;
  due_date?: string;
};

export function PremiumTaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: PremiumTask;
  onToggle: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="taskCard" dir="rtl">
      <button
        type="button"
        className={`taskCheck ${task.completed ? "taskCheckDone" : ""}`}
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? "סמן כלא בוצע" : "סמן כבוצע"}
        title={task.completed ? "סמן כלא בוצע" : "סמן כבוצע"}
      >
        {task.completed ? "✓" : ""}
      </button>

      <div>
        <div className="taskTitleRow">
          <div className={`taskTitle ${task.completed ? "taskTitleDone" : ""}`}>
            {task.title}
          </div>
        </div>

        <div className="taskMeta">
          {task.room_id && <span className="chip">🏡 {task.room_id}</span>}
          {task.scope && (
            <span className={`chip ${task.scope === "today" ? "chipAccent" : ""}`}>
              {task.scope === "today" ? "היום" : task.scope === "week" ? "השבוע" : task.scope}
            </span>
          )}
          {task.due_date && <span className="chip">📅 {task.due_date}</span>}
        </div>
      </div>

      <div className="taskActions">
        {onEdit && (
          <button className="iconBtn" type="button" onClick={() => onEdit(task.id)} title="עריכה">
            ✎
          </button>
        )}
        {onDelete && (
          <button className="iconBtn" type="button" onClick={() => onDelete(task.id)} title="מחיקה">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export type { PremiumTask };
