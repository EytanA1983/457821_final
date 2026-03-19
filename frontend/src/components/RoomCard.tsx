import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRoomRoute } from '../utils/routes';
import { useTasks } from '../hooks/useTasks';
import type { TaskRead } from '../schemas/task';
import styles from './RoomCard.module.css';

type Props = { 
  roomId: number; 
  name: string;
  customColor?: string;
};

// Room type detection and color mapping
type RoomType = 
  | 'living' 
  | 'kitchen' 
  | 'bedroom' 
  | 'bathroom' 
  | 'office' 
  | 'balcony' 
  | 'closet' 
  | 'kids'
  | 'laundry'
  | 'garage'
  | 'default';

// Detect room type from name (memoized outside component)
const detectRoomType = (roomName: string): RoomType => {
  const name = roomName.toLowerCase();
  
  if (name.includes('סלון') || name.includes('living') || name.includes('לובי') || name.includes('lobby')) {
    return 'living';
  }
  if (name.includes('מטבח') || name.includes('kitchen') || name.includes('אוכל') || name.includes('dining')) {
    return 'kitchen';
  }
  if (name.includes('שינה') || name.includes('bedroom') || name.includes('חדר הורים')) {
    return 'bedroom';
  }
  if (name.includes('שירותים') || name.includes('bathroom') || name.includes('אמבטיה') || name.includes('מקלחת')) {
    return 'bathroom';
  }
  if (name.includes('משרד') || name.includes('office') || name.includes('עבודה') || name.includes('study')) {
    return 'office';
  }
  if (name.includes('מרפסת') || name.includes('balcony') || name.includes('גינה') || name.includes('garden') || name.includes('פטיו')) {
    return 'balcony';
  }
  if (name.includes('ארון') || name.includes('closet') || name.includes('מחסן') || name.includes('storage')) {
    return 'closet';
  }
  if (name.includes('ילדים') || name.includes('kids') || name.includes('תינוק') || name.includes('baby') || name.includes('משחקים')) {
    return 'kids';
  }
  if (name.includes('מכבסה') || name.includes('laundry') || name.includes('כביסה')) {
    return 'laundry';
  }
  if (name.includes('מוסך') || name.includes('garage') || name.includes('חניה') || name.includes('parking')) {
    return 'garage';
  }
  
  return 'default';
};

const getRoomSubtitle = (roomType: RoomType, isEnglish: boolean): string => {
  switch (roomType) {
    case 'living':
      return isEnglish ? 'Living room - room to breathe' : 'סלון — אוויר לנשימה';
    case 'kitchen':
      return isEnglish ? 'Kitchen - small order that calms the day' : 'מטבח — סדר קטן שמרגיע את היום';
    case 'bedroom':
      return isEnglish ? 'Bedroom - calm starts in the closet' : 'חדר שינה — שקט שמתחיל בארון';
    case 'bathroom':
      return isEnglish ? 'Bathroom - quick clean, fresh feeling' : 'אמבטיה — ניקיון קל, תחושת רעננות';
    case 'office':
      return isEnglish ? 'Office - focused space without clutter' : 'משרד — מיקוד נעים בלי עומס';
    case 'balcony':
      return isEnglish ? 'Balcony - a light corner to clear your mind' : 'מרפסת — פינה קלה לניקוי הראש';
    case 'closet':
      return isEnglish ? 'Closet - fewer items, less pressure' : 'ארון — פחות חפצים, פחות לחצים';
    case 'kids':
      return isEnglish ? 'Kids room - one toy at a time' : 'חדר ילדים — צעצוע אחד בכל פעם';
    case 'laundry':
      return isEnglish ? 'Laundry - a few calm minutes of folding' : 'מכבסה — כמה דקות של קיפול שקט';
    case 'garage':
      return isEnglish ? 'Garage - functional and clean order' : 'מוסך — סדר פונקציונלי ונקי';
    default:
      return isEnglish ? 'Personal space for a calm daily reset' : 'מרחב אישי לסדר יומי רגוע';
  }
};

// Get CSS variable for room type
const getRoomStyle = (roomType: RoomType, customColor?: string): React.CSSProperties => {
  if (customColor) {
    return {
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      border: `1px solid ${customColor}`,
      '--room-accent': customColor,
    } as React.CSSProperties;
  }
  
  return {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    '--room-accent': `var(--room-${roomType}-accent)`,
  } as React.CSSProperties;
};

// Progress bar component (memoized)
const ProgressBar = memo(({ progress, isComplete }: { progress: number; isComplete: boolean }) => (
  <div 
    className="mt-3 h-3 rounded-full overflow-hidden shadow-inner"
    style={{ backgroundColor: 'var(--progress-bg, rgba(0,0,0,0.1))' }}
  >
    <div
      className="h-full transition-all duration-500"
      style={{ 
        width: `${progress}%`,
        background: isComplete 
          ? 'var(--progress-complete, linear-gradient(90deg, #10B981, #34D399))'
          : 'var(--progress-fill, linear-gradient(90deg, #AEDFF7, #7BC4E8))'
      }}
    />
  </div>
));
ProgressBar.displayName = 'ProgressBar';

// Progress text component (memoized)
const ProgressText = memo(({ 
  progress, 
  isComplete, 
  isLoading, 
  taskCount,
  completedCount,
  labels,
}: { 
  progress: number; 
  isComplete: boolean; 
  isLoading: boolean;
  taskCount: number;
  completedCount: number;
  labels: {
    complete: string;
    loading: string;
    noTasks: string;
    completedSuffix: string;
  };
}) => (
  <div className="flex items-center justify-between mt-2">
    <p className="text-sm text-gray-600 dark:text-gray-300">
      {isComplete ? (
        <span>{labels.complete}</span>
      ) : isLoading ? (
        <span className="animate-pulse">{labels.loading}</span>
      ) : taskCount === 0 ? (
        <span>{labels.noTasks}</span>
      ) : (
        <span>{progress}% {labels.completedSuffix}</span>
      )}
    </p>
    <span className="text-xs text-gray-500 dark:text-gray-400">{completedCount}/{taskCount}</span>
  </div>
));
ProgressText.displayName = 'ProgressText';

// Task count badge (memoized)
const TaskCountBadge = memo(({ completed, total }: { completed: number; total: number }) => {
  if (total === 0) return null;
  
  return (
    <div 
      className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full"
      style={{ 
        backgroundColor: 'var(--room-accent, #3b82f6)',
        color: '#fff'
      }}
    >
      {completed}/{total}
    </div>
  );
});
TaskCountBadge.displayName = 'TaskCountBadge';

// Main RoomCard component with React.memo
const RoomCardComponent = ({ roomId, name, customColor }: Props) => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || 'he').startsWith('en');
  const { data: tasks = [], isLoading } = useTasks({ roomId });
  const labels = isEnglish
    ? {
        complete: 'Completed',
        loading: 'Loading...',
        noTasks: 'No tasks yet',
        completedSuffix: 'completed',
      }
    : {
        complete: 'הושלם',
        loading: 'טוען...',
        noTasks: 'אין משימות',
        completedSuffix: 'הושלמו',
      };

  // Memoized calculations
  const roomType = useMemo(() => detectRoomType(name), [name]);
  const roomStyle = useMemo(() => getRoomStyle(roomType, customColor), [roomType, customColor]);
  const roomSubtitle = useMemo(() => getRoomSubtitle(roomType, isEnglish), [roomType, isEnglish]);
  
  // Memoize task statistics
  const { progress, completedCount, isComplete } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { progress: 0, completedCount: 0, isComplete: false };
    }
    const completed = tasks.filter((t: TaskRead) => t.completed).length;
    const prog = Math.round((completed / tasks.length) * 100);
    return { 
      progress: prog, 
      completedCount: completed, 
      isComplete: prog === 100 
    };
  }, [tasks]);

  return (
    <Link 
      to={getRoomRoute(roomId)} 
      className={`
        ${styles.card}
        block relative
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        touch-target
      `}
      style={roomStyle}
    >
      <div className={`${styles.cover} wow-fadeIn`} />

      {/* Room header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`${styles.title} truncate`}>{name}</h3>
          <p className={styles.subtitle}>{roomSubtitle}</p>
        </div>
      </div>
      
      {/* Progress bar */}
      <ProgressBar progress={progress} isComplete={isComplete} />
      
      {/* Progress text */}
      <ProgressText 
        progress={progress} 
        isComplete={isComplete} 
        isLoading={isLoading}
        taskCount={tasks.length}
        completedCount={completedCount}
        labels={labels}
      />
      
      {/* Task count badge */}
      <TaskCountBadge completed={completedCount} total={tasks.length} />
    </Link>
  );
};

// Export memoized component with custom comparison
export const RoomCard = memo(RoomCardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.name === nextProps.name &&
    prevProps.customColor === nextProps.customColor
  );
});
RoomCard.displayName = 'RoomCard';

/**
 * RoomCardSkeleton - Loading placeholder (already static, no need for memo)
 */
export const RoomCardSkeleton = () => (
  <div className="block p-5 rounded-xl shadow-md bg-gray-200 dark:bg-dark-surface animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 bg-gray-300 dark:bg-dark-border rounded-full" />
      <div className="h-5 w-24 bg-gray-300 dark:bg-dark-border rounded" />
    </div>
    <div className="mt-3 h-3 bg-gray-300 dark:bg-dark-border rounded-full" />
    <div className="flex items-center justify-between mt-2">
      <div className="h-4 w-20 bg-gray-300 dark:bg-dark-border rounded" />
      <div className="w-6 h-6 bg-gray-300 dark:bg-dark-border rounded-full" />
    </div>
  </div>
);

export default RoomCard;
