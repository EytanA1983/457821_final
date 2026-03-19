import { memo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useVoice } from '../hooks/useVoice';
import api from '../api';
import { TodoRead } from '../schemas/todo';

type Props = {
  todo: TodoRead;
  taskId: number;
  onChange: () => void;
};

/**
 * TodoItem component with React.memo for performance
 * Prevents re-renders when parent component updates but todo hasn't changed
 */
const TodoItemComponent = ({ todo, onChange }: Props) => {
  const { speak } = useVoice();

  const updateTodoMutation = useMutation({
    mutationFn: async (completed: boolean) => {
      const response = await api.put(`/todos/${todo.id}`, {
        completed,
      });
      return response.data;
    },
    onSuccess: (_data, completed) => {
      speak(completed ? 'תת‑משימה הושלמה' : 'ביטלת את ה‑תת‑משימה');
      onChange();
    },
    onError: (error) => {
      console.error('Failed to update todo:', error);
      speak('שגיאה בעדכון תת‑משימה');
    },
  });

  // Memoize toggle handler to prevent new function on each render
  const toggle = useCallback(() => {
    updateTodoMutation.mutate(!todo.completed);
  }, [todo.completed, updateTodoMutation]);

  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-border p-2 rounded transition-colors">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={toggle}
        disabled={updateTodoMutation.isPending}
        className="form-checkbox h-4 w-4 text-mint cursor-pointer disabled:opacity-50"
      />
      <span className={`flex items-center gap-2 ${todo.completed ? 'line-through text-gray-500' : 'text-gray-800 dark:text-dark-text'}`}>
        {todo.completed ? (
          <span className="emoji text-sm">✅</span>
        ) : (
          <span className="emoji text-sm">☐</span>
        )}
        <span>{todo.title}</span>
        {updateTodoMutation.isPending && (
          <span className="text-xs text-gray-400 animate-pulse">מעדכן...</span>
        )}
      </span>
    </label>
  );
};

// Export with React.memo and custom comparison
export const TodoItem = memo(TodoItemComponent, (prevProps, nextProps) => {
  // Only re-render if todo data changes
  return (
    prevProps.todo.id === nextProps.todo.id &&
    prevProps.todo.completed === nextProps.todo.completed &&
    prevProps.todo.title === nextProps.todo.title &&
    prevProps.taskId === nextProps.taskId
    // Note: onChange is intentionally not compared as it's expected to be stable
    // If parent uses useCallback for onChange, this is safe
  );
});
TodoItem.displayName = 'TodoItem';

export default TodoItem;
