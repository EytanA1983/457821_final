import { useEffect, useState, useCallback } from "react";
import { clearTokens, getAccessToken, getRefreshToken } from "../utils/tokenStorage";
import api, { fetchMe } from "../api";
import { smokeDebug } from "../utils/smokeDebug";
import { ROUTES } from "../utils/routes";

/**
 * useAuth Hook - Global authentication state management
 * 
 * Features:
 * - Checks for token in localStorage
 * - Verifies token with backend via fetchMe() (unified "who am I" function)
 * - Updates on token changes (storage events, custom events)
 * - Provides isAuthenticated state and user data
 * 
 * Usage:
 * const { isAuthenticated, user, checkAuth, isLoading } = useAuth();
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status with backend
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getAccessToken();
      const hasToken = !!token;

      smokeDebug("useAuth:check", {
        hasToken,
        tokenLength: token?.length || 0,
      });

      if (!hasToken) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // CRITICAL: Verify token with backend via fetchMe()
      // This is the authentication step
      try {
        const response = await fetchMe();
        if (response.status === 200 && response.data) {
          smokeDebug("useAuth:verified", {
            userId: response.data.id,
            email: response.data.email,
          });
          setIsAuthenticated(true);
          setUser(response.data);
          setIsLoading(false);
        } else {
          throw new Error('Invalid response from /api/auth/me');
        }
      } catch (error: any) {
        console.warn('[useAuth] ❌ Token verification failed:', {
          status: error.response?.status,
          message: error.message,
        });
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[useAuth] ❌ Error checking auth:', error);
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial check - verify with backend
    checkAuth();

    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'refresh_token') {
        smokeDebug("useAuth:storage_token_change", { key: e.key ?? "" });
        checkAuth();
      }
    };

    // Listen for custom event (same-tab)
    const handleTokenChange = () => {
      smokeDebug("useAuth:token_changed_event", {});
      // Same-tab login writes tokens synchronously; deferring caused Home/Dashboard to render
      // with `user === null` briefly and skip task/progress queries until a later navigation.
      void checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('token-changed', handleTokenChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('token-changed', handleTokenChange);
    };
  }, [checkAuth]);

  const logout = useCallback(() => {
    const refresh = getRefreshToken();
    smokeDebug("logout:start", { hasRefresh: !!refresh });
    void (async () => {
      try {
        if (refresh) {
          await api.post("/auth/logout", { refresh_token: refresh });
        }
      } catch {
        // Best-effort revoke; always clear client session.
      } finally {
        clearTokens();
        setIsAuthenticated(false);
        setUser(null);
        window.dispatchEvent(new Event("token-changed"));
        window.location.assign(ROUTES.LOGIN);
      }
    })();
  }, []);

  return { 
    isAuthenticated, 
    setIsAuthenticated,
    user,
    isLoading,
    checkAuth,
    logout,
  };
};
