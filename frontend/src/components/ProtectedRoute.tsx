// src/components/ProtectedRoute.tsx
import { ReactNode, useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROUTES } from '../utils/routes';
import { fetchMe } from '../api.ts';
import { LoadingSpinner } from './LoadingSpinner';
import { clearTokens, getAccessToken, getRefreshToken } from '../utils/tokenStorage';
import { SessionExpiredPage } from '../pages/SessionExpiredPage';
import { smokeDebug } from '../utils/smokeDebug';

/**
 * ProtectedRoute - Guards routes that require authentication
 * 
 * This is the critical component that connects:
 * - token (localStorage)
 * - backend (fetchMe)
 * - routing (Navigate)
 * 
 * Features:
 * - Checks for token on mount
 * - If token exists → verifies with backend via fetchMe()
 * - If no token or verification fails → shows SessionExpiredPage
 * - Shows loading state while checking auth
 * - Clears invalid tokens
 * 
 * Usage:
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <DashboardPage />
 *   </ProtectedRoute>
 * } />
 */
export const ProtectedRoute = ({ children }: { children?: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);

      const returnTo = `${location.pathname}${location.search}`;
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (!access && !refresh) {
        smokeDebug("protected:no_session", { returnTo });
        navigate(ROUTES.LOGIN, { replace: true, state: { from: returnTo } });
        return;
      }

      smokeDebug("protected:verify_start", {
        returnTo,
        hasAccess: !!access,
        hasRefresh: !!refresh,
      });

      try {
        const response = await fetchMe();
        if (response.status === 200 && response.data) {
          smokeDebug("protected:fetchMe_ok", { userId: response.data?.id });
          setAuthorized(true);
          setLoading(false);
          return;
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        const status = axiosError?.response?.status;
        smokeDebug("protected:fetchMe_error", {
          status: status ?? "none",
          code: axiosError.code,
        });
        if (status === 401) {
          clearTokens();
          setTokenExpired(true);
          setAuthorized(false);
        } else {
          // Do not clear tokens on transient/non-auth failures.
          navigate(ROUTES.LOGIN, { replace: true, state: { from: returnTo } });
          return;
        }
      }

      setLoading(false);
    };

    // Check auth on mount
    checkAuth();
  }, [navigate, location.pathname, location.search]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" label={isEnglish ? "Checking authorization..." : "בודק הרשאות..."} />
      </div>
    );
  }

  // Show friendly session expired page only if token was expired (not just missing)
  if (!authorized && tokenExpired) {
    return <SessionExpiredPage />;
  }

  // If not authorized and not expired, we should have redirected already.
  if (!authorized) {
    return null;
  }

  // Render protected content
  return children ? <>{children}</> : <Outlet />;
};
