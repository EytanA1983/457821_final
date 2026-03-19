interface Task {
  id: string;
  title: string;
  completed: boolean;
  room_id?: string;
  scope?: string;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  isEnglish?: boolean;
}

const TaskItem = ({ task, onToggle, isEnglish = false }: TaskItemProps) => {
  return (
    <div className="taskCard" dir={isEnglish ? "ltr" : "rtl"}>
      <button
        className={`taskCheck ${task.completed ? "taskCheckDone" : ""}`}
        onClick={() => onToggle(task.id)}
      >
        {task.completed ? "✓" : ""}
      </button>

      <div>
        <div
          className={`taskTitle ${
            task.completed ? "taskTitleDone" : ""
          }`}
        >
          {task.title}
        </div>

        <div className="taskMeta">
          {task.room_id && (
            <span className="chip">🏡 {task.room_id}</span>
          )}
          {task.scope && (
            <span
              className={`chip ${
                task.scope === "today" ? "chipAccent" : ""
              }`}
            >
              {task.scope === "today" ? (isEnglish ? "Today" : "היום") : task.scope}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
