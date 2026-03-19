import { HouseView } from "../components/HouseView";
import { useTranslation } from "react-i18next";

/**
 * HousePage - דף תצוגת בית עם SVG אינטראקטיבי
 * 
 * Features:
 * - תצוגת בית עם SVG
 * - לחיצה על חדר → מעבר ל-RoomPage
 * - בחירת חדרים מתוך תצוגה ויזואלית
 * 
 * Note: Header is provided by AppLayout, no need for NavBar here
 */
export const HousePage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            {isEnglish ? "🏡 House View" : "🏡 תצוגת הבית"}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isEnglish ? "Tap a room to see its tasks" : "לחץ על חדר כדי לראות את המשימות שלו"}
          </p>
        </div>
        <HouseView />
      </div>
    </div>
  );
};

export default HousePage;
