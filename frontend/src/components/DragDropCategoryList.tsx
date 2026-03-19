/**
 * Drag & Drop Category List Component
 * Component for displaying categories with drag & drop reordering
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../api';
import { useTranslation } from 'react-i18next';

interface Category {
  id: number;
  name: string;
  icon?: string;
  position?: number;
}

interface DragDropCategoryListProps {
  categories: Category[];
  onCategoriesUpdate?: (categories: Category[]) => void;
  onCategoryClick?: (categoryId: number) => void;
}

interface SortableCategoryItemProps {
  category: Category;
  onClick?: () => void;
}

const SortableCategoryItem: React.FC<SortableCategoryItemProps> = ({ category, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

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
        bg-white rounded-lg shadow-sm p-3 border border-gray-200
        ${isDragging ? 'shadow-lg' : ''}
        cursor-grab active:cursor-grabbing
        hover:bg-cream transition-colors
        ${onClick ? 'cursor-pointer' : ''}
      `}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {category.icon && <span className="text-2xl">{category.icon}</span>}
        <span className="font-medium text-gray-900">{category.name}</span>
        <span className="text-gray-400 ml-auto">⋮⋮</span>
      </div>
    </div>
  );
};

export const DragDropCategoryList: React.FC<DragDropCategoryListProps> = ({
  categories: initialCategories,
  onCategoriesUpdate,
  onCategoryClick,
}) => {
  const { t } = useTranslation('tasks');
  const [categories, setCategories] = useState<Category[]>(initialCategories);
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

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update UI
    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);
    setIsReordering(true);

    try {
      // Send reorder request to backend
      const categoryIds = newCategories.map((cat) => cat.id);
      await api.put('/drag-drop/categories/reorder', {
        category_ids: categoryIds,
      });

      // Update parent component
      onCategoriesUpdate?.(newCategories);
    } catch (error) {
      console.error('Failed to reorder categories:', error);
      // Revert on error
      setCategories(initialCategories);
    } finally {
      setIsReordering(false);
    }
  };

  // Update categories when initialCategories change
  React.useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={categories.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              onClick={() => onCategoryClick?.(category.id)}
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
