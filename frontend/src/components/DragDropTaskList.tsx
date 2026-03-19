/**
 * Drag & Drop Task List Component
 * Component for displaying tasks with drag & drop reordering
 */
import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

// Local replacement for the broken generated-api hook
function useTodos(taskId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['todos', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/todos`);
      return data as { id: number; title: string; completed: boolean; position?: number }[];
    },
    enabled: options?.enabled ?? !!taskId,
  });
}

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  position?: number;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  due_date?: string;
  category_id?: number;
  room_id?: number;
  position?: number;
  todos?: Todo[];
}

interface DragDropTaskListProps {
  tasks: Task[];
  onTasksUpdate?: (tasks: Task[]) => void;
  roomId?: number;
  categoryId?: number;
}

interface SortableTaskItemProps {
  task: Task;
  onToggleComplete?: (taskId: number) => void;
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({ task, onToggleComplete }) => {
  // Fetch todos for this task
  const { data: todos = [] } = useTodos(task.id, {
    enabled: !!task.id,
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-lg shadow-sm p-4 mb-2 border border-gray-200
        ${task.completed ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-lg' : ''}
        cursor-grab active:cursor-grabbing
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete?.(task.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-5 h-5 text-mint focus:ring-mint rounded"
        />
        <div className="flex-1">
          <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          )}
          {task.due_date && (
            <p className="text-xs text-gray-500 mt-1">
              📅 {new Date(task.due_date).toLocaleDateString()}
            </p>
          )}
          {/* Display todos if available */}
          {todos.length > 0 && (
            <div className="mt-2 space-y-1 pl-4 border-r-2 border-gray-200">
              {todos.map((todo) => (
                <label
                  key={todo.id}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    readOnly
                    className="h-3 w-3 text-sky-600 cursor-pointer"
                  />
                  <span className={todo.completed ? 'line-through opacity-60' : ''}>
                    {todo.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="text-gray-400">⋮⋮</div>
      </div>
    </div>
  );
};

export const DragDropTaskList: React.FC<DragDropTaskListProps> = ({
  tasks: initialTasks,
  onTasksUpdate,
  roomId,
  categoryId,
}) => {
  const { t } = useTranslation('tasks');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = tasks.findIndex((task) => task.id === active.id);
    const newIndex = tasks.findIndex((task) => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update UI
    const newTasks = arrayMove(tasks, oldIndex, newIndex);
    setTasks(newTasks);
    setIsReordering(true);

    try {
      // Send reorder request to backend
      const taskIds = newTasks.map((task) => task.id);
      await api.put('/drag-drop/tasks/reorder', {
        task_ids: taskIds,
        room_id: roomId,
        category_id: categoryId,
      });

      // Update parent component
      onTasksUpdate?.(newTasks);
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      // Revert on error
      setTasks(initialTasks);
    } finally {
      setIsReordering(false);
    }
  };

  const handleToggleComplete = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic update
    const newCompleted = !task.completed;
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, completed: newCompleted } : t
      )
    );

    try {
      // Use PATCH /api/tasks/{id} to toggle completion
      await api.patch(`/tasks/${taskId}`, { completed: newCompleted });
      // Update parent component
      const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t)) as Task[];
      onTasksUpdate?.(updatedTasks);
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
      // Revert on error
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, completed: task.completed } : t
        )
      );
    }
  };

  // Update tasks when initialTasks change
  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('no_tasks')}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      </SortableContext>
      {isReordering && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {t('reordering')}
        </div>
      )}
    </DndContext>
  );
};
