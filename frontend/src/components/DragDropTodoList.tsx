/**
 * Drag & Drop Todo List Component
 * Component for displaying todos with drag & drop reordering
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

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  task_id: number;
  position?: number;
}

interface DragDropTodoListProps {
  todos: Todo[];
  taskId: number;
  onTodosUpdate?: (todos: Todo[]) => void;
}

interface SortableTodoItemProps {
  todo: Todo;
  onToggleComplete?: (todoId: number) => void;
}

const SortableTodoItem: React.FC<SortableTodoItemProps> = ({ todo, onToggleComplete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

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
        bg-gray-50 rounded p-2 mb-1 border border-gray-200
        ${todo.completed ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-md' : ''}
        cursor-grab active:cursor-grabbing
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggleComplete?.(todo.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-mint focus:ring-mint rounded"
        />
        <span className={`text-sm ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
          {todo.title}
        </span>
        <span className="text-gray-400 ml-auto text-xs">⋮⋮</span>
      </div>
    </div>
  );
};

export const DragDropTodoList: React.FC<DragDropTodoListProps> = ({
  todos: initialTodos,
  taskId,
  onTodosUpdate,
}) => {
  const { t } = useTranslation('tasks');
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
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

    const oldIndex = todos.findIndex((todo) => todo.id === active.id);
    const newIndex = todos.findIndex((todo) => todo.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update UI
    const newTodos = arrayMove(todos, oldIndex, newIndex);
    setTodos(newTodos);
    setIsReordering(true);

    try {
      // Send reorder request to backend
      const todoIds = newTodos.map((todo) => todo.id);
      await api.put('/drag-drop/todos/reorder', {
        todo_ids: todoIds,
        task_id: taskId,
      });

      // Update parent component
      onTodosUpdate?.(newTodos);
    } catch (error) {
      console.error('Failed to reorder todos:', error);
      // Revert on error
      setTodos(initialTodos);
    } finally {
      setIsReordering(false);
    }
  };

  const handleToggleComplete = async (todoId: number) => {
    try {
      // Update todo completion (you may need to add this endpoint)
      // await api.put(`/api/todos/${todoId}/toggle`);
      
      // Update local state
      setTodos((prevTodos) =>
        prevTodos.map((todo) =>
          todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
        )
      );
    } catch (error) {
      console.error('Failed to toggle todo completion:', error);
    }
  };

  // Update todos when initialTodos change
  React.useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  if (todos.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1 mt-2">
          {todos.map((todo) => (
            <SortableTodoItem
              key={todo.id}
              todo={todo}
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
