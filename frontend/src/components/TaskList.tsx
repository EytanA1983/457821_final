import { useMemo } from "react";
import api from "../api";
import { useTasks } from "../hooks/useTasks";
import TaskItem from "./TaskItem";
import type { TaskRead } from "../schemas/task";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  room_id?: string;
  scope?: string;
}

interface TaskListProps {
  tasks?: Task[];
  onTaskToggle?: (id: string) => void;
  filter?: {
    roomId?: number;
    categoryId?: number;
  };
}

const TaskList = ({
  tasks = [],
  onTaskToggle,
  filter,
}: TaskListProps) => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const ui = isEnglish
    ? {
        fallbackTask: "Task",
        loading: "Loading tasks...",
        empty: "No tasks here right now",
        emptyHint: "This is a great moment to add one small task.",
      }
    : {
        fallbackTask: "משימה",
        loading: "טוען משימות...",
        empty: "אין משימות כאן כרגע",
        emptyHint: "אולי זה זמן מושלם להוסיף משימה קטנה שתיצור שקט גדול.",
      };
  const queryClient = useQueryClient();
  const { data: fetchedTasks = [], isLoading } = useTasks(filter);

  const effectiveTasks = useMemo<Task[]>(() => {
    if (tasks.length > 0) return tasks;

    return (fetchedTasks as TaskRead[]).map((task) => ({
      id: String(task.id),
      title: task.title ?? ui.fallbackTask,
      completed: Boolean(task.completed),
      room_id: task.room_id ? String(task.room_id) : undefined,
      scope: (task as TaskRead & { scope?: string }).scope,
    }));
  }, [tasks, fetchedTasks, ui.fallbackTask]);

  const handleToggle = async (id: string) => {
    if (onTaskToggle) {
      onTaskToggle(id);
      return;
    }

    const current = effectiveTasks.find((t) => t.id === id);
    if (!current) return;

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;

    try {
      await api.put(`/tasks/${numericId}`, { completed: !current.completed });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error) {
      console.error("[TaskList] Failed to toggle task:", error);
    }
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="emptyState">
        <div className="emptyTitle">{ui.loading}</div>
      </div>
    );
  }

  if (!effectiveTasks || effectiveTasks.length === 0) {
    return (
      <div className="emptyState">
        <div className="emptyTitle">{ui.empty}</div>
        <div>
          {ui.emptyHint}
        </div>
      </div>
    );
  }

  return (
    <div className="taskList">
      {effectiveTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={handleToggle}
          isEnglish={isEnglish}
        />
      ))}
    </div>
  );
};

export default TaskList;
