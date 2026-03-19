import { DailyTasksPopup } from "../components/DailyTasksPopup";
import { WeeklyTasksWidget } from "../components/WeeklyTasksWidget";
import { useRooms } from "../hooks/useRooms";
import { RoomCard } from "../components/RoomCard";
import { Link } from "react-router-dom";
import { ROUTES } from "../utils/routes";
import { useTranslation } from "react-i18next";

export const HomePage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const t = isEnglish
    ? {
        title: "Home Organization",
        subtitle: "All your tasks and rooms in one place. Start with one important action and keep moving.",
        newTask: "New Task",
        calendar: "Calendar",
        myRooms: "My Rooms",
        allRooms: "All Rooms",
        loading: "Loading...",
        noRooms: "No rooms yet. Start by creating your first room.",
        createRoom: "Create Room",
      }
    : {
        title: "סידור וארגון הבית",
        subtitle: "כל המשימות והחדרים במקום אחד. התחל מפעולה אחת חשובה והמשך משם.",
        newTask: "משימה חדשה",
        calendar: "ליומן",
        myRooms: "החדרים שלי",
        allRooms: "כל החדרים",
        loading: "טוען...",
        noRooms: "אין חדרים כרגע. אפשר להתחיל ביצירת חדר ראשון.",
        createRoom: "צור חדר חדש",
      };
  const { data: rooms = [], isLoading: loading } = useRooms();

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 safe-bottom" dir={isEnglish ? "ltr" : "rtl"}>
      <DailyTasksPopup />

      <section className="px-4 py-8 sm:px-6 sm:py-10 max-w-7xl mx-auto">
        <div className="mb-8 sm:mb-10 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl">
            {t.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={ROUTES.ADD_TASK}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {t.newTask}
            </Link>
            <Link
              to={ROUTES.CALENDAR}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t.calendar}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <WeeklyTasksWidget />
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t.myRooms}</h2>
              <Link 
                to={ROUTES.ROOMS} 
                className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium touch-target px-3 py-2"
              >
                {t.allRooms}
              </Link>
            </div>

            {loading ? (
              <p className="text-center py-10 text-sm sm:text-base text-gray-500">{t.loading}</p>
            ) : rooms?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {rooms.slice(0, 4).map((room) => (
                  <RoomCard key={room.id} roomId={room.id} name={room.name} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-10 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t.noRooms}
                </p>
                <Link 
                  to={ROUTES.ROOMS}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {t.createRoom}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
