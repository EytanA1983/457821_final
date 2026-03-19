import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useRooms } from "../hooks/useRooms";
import { ROUTES, getRoomRoute } from "../utils/routes";
import { getRoomEmoji } from "../utils/roomColors";

/**
 * RoomsMenu - תפריט עם רשימת חדרים + "כל המשימות"
 * 
 * Features:
 * - Dropdown menu עם רשימת כל החדרים
 * - קישור "כל המשימות"
 * - עיצוב responsive
 * - סגירה אוטומטית אחרי בחירה
 */
export const RoomsMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: rooms = [], isLoading } = useRooms();
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleRoomClick = (roomId: number) => {
    navigate(getRoomRoute(roomId));
    setIsOpen(false);
  };

  const handleAllTasksClick = () => {
    navigate(ROUTES.ALL_TASKS);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2
          bg-white/20 dark:bg-white/10
          hover:bg-white/30 dark:hover:bg-white/20
          rounded-lg transition-colors
          touch-target
        "
        aria-label="תפריט חדרים"
        aria-expanded={isOpen}
      >
        <span className="emoji text-lg">📦</span>
        <span className="hidden sm:inline font-medium">חדרים</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown Content */}
          <div
            className="
              absolute right-0 mt-2 w-64 z-20
              bg-white dark:bg-gray-800
              border border-gray-200 dark:border-gray-700
              rounded-lg shadow-lg
              py-2
              max-h-[80vh] overflow-y-auto
              animate-fade-in
            "
            role="menu"
          >
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                📦 חדרים
              </h3>
            </div>

            {/* כל המשימות */}
            <button
              onClick={handleAllTasksClick}
              className="
                w-full px-4 py-3 flex items-center gap-3
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-colors text-start
                touch-target
              "
              role="menuitem"
            >
              <span className="emoji text-xl">📋</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                כל המשימות
              </span>
            </button>

            {/* Divider */}
            {rooms.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  חדרים ({rooms.length})
                </p>
              </div>
            )}

            {/* Rooms List */}
            {isLoading ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                <span className="animate-spin inline-block mr-2">⏳</span>
                טוען חדרים...
              </div>
            ) : rooms.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                אין חדרים
              </div>
            ) : (
              rooms.map((room) => {
                const emoji = getRoomEmoji(room.name);
                return (
                  <button
                    key={room.id}
                    onClick={() => handleRoomClick(room.id)}
                    className="
                      w-full px-4 py-3 flex items-center gap-3
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors text-start
                      touch-target
                    "
                    role="menuitem"
                  >
                    <span className="emoji text-xl">{emoji}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {room.name}
                    </span>
                  </button>
                );
              })
            )}

            {/* Footer - Link to all rooms page */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <NavLink
                to={ROUTES.ROOMS}
                onClick={() => setIsOpen(false)}
                className="
                  block text-sm text-sky-600 dark:text-sky-400
                  hover:underline text-center
                  touch-target py-1
                "
              >
                צפה בכל החדרים →
              </NavLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
