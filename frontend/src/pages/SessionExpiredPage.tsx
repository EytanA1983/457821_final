// src/pages/SessionExpiredPage.tsx
import { Link } from 'react-router-dom';
import { ROUTES } from '../utils/routes';
import { useTranslation } from 'react-i18next';

/**
 * SessionExpiredPage - Friendly session expired page
 * 
 * Shown when user's session expires or token becomes invalid.
 * Provides a better UX than a hard redirect to login.
 */
export const SessionExpiredPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-cream via-cream/95 to-cream p-4" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="mb-6">
          <span className="emoji text-6xl">⏰</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          {isEnglish ? "Session expired" : "הפגישה פגה"}
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6 text-lg">
          {isEnglish ? "Your session expired for security reasons. Please sign in again to continue." : "הפגישה שלך פגה מסיבות אבטחה. אנא התחבר שוב כדי להמשיך."}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <Link
            to={ROUTES.LOGIN}
            className="w-full bg-gradient-to-r from-sky to-sky/90 text-white py-3 px-6 rounded-lg hover:from-sky/90 hover:to-sky transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <span className="emoji">🔑</span>
            <span>{isEnglish ? "Sign in again" : "התחבר שוב"}</span>
          </Link>

          <Link
            to={ROUTES.REGISTER}
            className="w-full text-sky hover:text-sky/80 font-medium text-sm"
          >
            {isEnglish ? "No account yet? Register here" : "אין לך חשבון? הירשם כאן"}
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-6 text-sm text-gray-500">
          {isEnglish ? "If the issue persists, try clearing your browser cache" : "אם הבעיה נמשכת, נסה לנקות את ה-cache של הדפדפן"}
        </p>
      </div>
    </div>
  );
};

export default SessionExpiredPage;
