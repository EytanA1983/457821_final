/**
 * Token Storage Utility
 * 
 * Manages token storage and retrieval.
 * 
 * Strategy: localStorage
 * - Persists across page refreshes
 * - Accessible across tabs
 * - Not accessible to JavaScript in other domains (XSS protection)
 * - Not sent automatically with requests (CSRF protection)
 * 
 * Alternative strategies considered:
 * - Memory: Lost on refresh, not suitable for SPA
 * - Cookies: Auto-sent with requests (CSRF risk), requires SameSite protection
 * - SessionStorage: Lost when tab closes, not suitable for "remember me"
 */

// Export keys so other components can listen to storage events
export const ACCESS_TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payloadText = atob(padded);
    return JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (!exp) return false; // If no exp claim, keep previous behavior.
  const now = Math.floor(Date.now() / 1000);
  // 30 seconds safety window for clock drift/network delay.
  return exp <= now + 30;
};

/**
 * Get access token from storage
 */
export const getAccessToken = (): string | null => {
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    console.log('[TokenStorage] 🔍 Getting access token:', {
      key: ACCESS_TOKEN_KEY,
      found: !!token,
      tokenLength: token?.length || 0,
      allKeys: Object.keys(localStorage).filter(k => k.includes('token')),
    });
    return token;
  } catch (error) {
    console.error('[TokenStorage] Error getting access token:', error);
    return null;
  }
};

/**
 * Get refresh token from storage
 */
export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('[TokenStorage] Error getting refresh token:', error);
    return null;
  }
};

/**
 * Save access token to storage
 */
export const setAccessToken = (token: string): void => {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    console.log('[TokenStorage] ✅ Access token saved:', {
      key: ACCESS_TOKEN_KEY,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
      actualValue: localStorage.getItem(ACCESS_TOKEN_KEY)?.substring(0, 20) + '...',
    });
  } catch (error) {
    console.error('[TokenStorage] Error saving access token:', error);
    throw new Error('לא ניתן לשמור token - בדוק את ההגדרות של הדפדפן');
  }
};

/**
 * Save refresh token to storage
 */
export const setRefreshToken = (token: string): void => {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    console.log('[TokenStorage] Refresh token saved');
  } catch (error) {
    console.error('[TokenStorage] Error saving refresh token:', error);
    // Don't throw - refresh token is optional
  }
};

/**
 * Save both tokens
 */
export const setTokens = (accessToken: string, refreshToken?: string): void => {
  setAccessToken(accessToken);
  if (refreshToken) {
    setRefreshToken(refreshToken);
  }
};

/**
 * Clear all tokens from storage
 */
export const clearTokens = (): void => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    console.log('[TokenStorage] Tokens cleared');
  } catch (error) {
    console.error('[TokenStorage] Error clearing tokens:', error);
  }
};

/**
 * Check if there is any session material for the SPA (access and/or refresh).
 *
 * IMPORTANT: Do not clear tokens here when the access JWT is past `exp`.
 * The axios interceptor can refresh using `refresh_token`; clearing here
 * caused random logouts and blocked navigation right after login in dev.
 */
export const hasTokens = (): boolean => {
  try {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    if (access && !isTokenExpired(access)) return true;
    if (refresh) return true;
    return !!access;
  } catch {
    return false;
  }
};
