import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { ROUTES } from '../utils/routes';
import { useTranslation } from 'react-i18next';

export const GoogleLoginRedirect = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      // שליחת קוד ל‑backend (endpoint שהגדרנו)
      api
        .get('/auth/google/callback', { params: { code } })
        .then(() => navigate(ROUTES.SETTINGS, { replace: true }))
        .catch((error) => {
          console.error('Error in Google callback:', error);
          navigate(`${ROUTES.SETTINGS}?error=google_auth_failed`, { replace: true });
        });
    } else {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [location.search, navigate]);

  return <p>{isEnglish ? "Waiting for Google authentication..." : "ממתין לאימות Google…"}</p>;
};
