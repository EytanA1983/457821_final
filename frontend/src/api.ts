import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ProgressSummaryRead } from './schemas/progress';
import type { DailyInspirationRead, DailyTipRead } from './schemas/dashboard';
import type { VisionBoardRead, VisionBoardUpdate } from './schemas/vision_board';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './utils/tokenStorage';
import { showError } from './utils/toast';
import i18n from './i18n/config';

/**
 * Resolve API base URL.
 *
 * In Vite dev, prefer same-origin `/api` when the configured backend is local
 * (localhost / 127.0.0.1 :8000). That uses `vite.config.ts` proxy → no browser CORS.
 *
 * Set `VITE_API_NO_PROXY=true` to force a direct `http://localhost:8000/api` URL in dev
 * (e.g. to test backend CORS headers).
 */
function resolveApiBaseUrl(): string {
  const fromEnv =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    '';

  const noProxy = import.meta.env.VITE_API_NO_PROXY === 'true';

  if (import.meta.env.DEV && !noProxy) {
    if (!fromEnv) {
      return '/api';
    }
    if (/^https?:\/\//i.test(fromEnv)) {
      try {
        const parsed = new URL(fromEnv);
        const isLocalBackend =
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
          (parsed.port === '8000' || parsed.port === '');
        if (isLocalBackend) {
          return '/api';
        }
      } catch {
        /* fall through to normalization below */
      }
    }
    if (fromEnv === '/api' || fromEnv.startsWith('/api/')) {
      return fromEnv.replace(/\/+$/, '') || '/api';
    }
  }

  const fallback = fromEnv || 'http://localhost:8000/api';
  const candidate = fallback.replace(/\/+$/, '');

  // If a full URL is provided without a path (e.g. http://localhost:8000),
  // normalize it to include /api so existing endpoint calls (/tasks, /rooms) still work.
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
        parsed.pathname = '/api';
        return parsed.toString().replace(/\/+$/, '');
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return candidate;
    }
  }

  return candidate;
}

const API_BASE_URL = resolveApiBaseUrl();
const API_VERBOSE_DEBUG = import.meta.env.DEV && import.meta.env.VITE_API_VERBOSE === 'true';
const unauthenticatedWarnedUrls = new Set<string>();

function logAxiosError(err: unknown, context = 'Request failed') {
  if (axios.isAxiosError(err)) {
    const fullUrl = err.config?.baseURL
      ? `${err.config.baseURL}${err.config.url || ''}`
      : err.config?.url;
    const hasResponse = !!err.response;
    const errorKind = hasResponse ? 'http_error' : (err.code === 'ERR_NETWORK' ? 'network_error' : 'request_error');

    // Skip logging for expected/transient errors that are handled
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isNetworkError = errorKind === 'network_error';
    const isExpectedError = 
      (status === 401 && url.includes('/auth/')) || // Auth endpoint 401s are expected
      (status === 404 && url.includes('/rooms')) || // 404s are handled gracefully
      (status === 404 && url.includes('/inventory/')) || // 404s on inventory are expected (no data yet)
      (status === 204); // 204 No Content is success
    
    // For network errors, provide more helpful logging
    if (isNetworkError) {
      console.warn(`[API] Network error: Cannot reach server at ${fullUrl}`, {
        message: err.message,
        code: err.code,
        method: err.config?.method?.toUpperCase(),
        url: err.config?.url,
        fullURL: fullUrl,
        hint: 'Check if backend server is running on the correct port',
      });
      return;
    }
    
    if (isExpectedError && !import.meta.env.DEV) {
      // In production, don't log expected errors
      return;
    }

    const payload = {
      kind: errorKind,
      message: err.message,
      code: err.code,
      method: err.config?.method?.toUpperCase(),
      url: err.config?.url,
      fullURL: fullUrl,
      status: status,
      statusText: err.response?.statusText,
      data: err.response?.data,
    };
    
    // Only log full details in dev mode or for unexpected errors
    if (import.meta.env.DEV || !isExpectedError) {
      console.error(`[API] ${context} AxiosError`, payload);
      if (import.meta.env.DEV) {
        console.error(`[API] ${context} AxiosError JSON`, JSON.stringify(payload, null, 2));
      }
    }
    return;
  }
  console.error(`[API] ${context} Non-Axios error`, err);
}

/**
 * Axios instance configuration
 *
 * Dev: same-origin `/api` when backend is local :8000 (Vite proxy) — avoids CORS.
 * Prod / remote API: set `VITE_API_BASE_URL` or `VITE_API_URL` to your API origin.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Validate status codes - accept 200-299 and 204 (No Content) as success
  // This ensures 204 No Content responses are treated as successful (not errors)
  validateStatus: function (status) {
    // Accept all 2xx status codes (200-299) including 204 No Content
    return status >= 200 && status < 300;
  },
});

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Request Interceptor
 * 
 * CRITICAL: This interceptor MUST add Authorization header to all requests
 * if a token exists in localStorage.
 * 
 * Automatically adds Authorization: Bearer <access_token> to all requests
 * if a token exists in localStorage.
 * 
 * Features:
 * - Checks localStorage for access_token
 * - Adds Authorization header if token exists
 * - Preserves existing Content-Type headers
 * - Logs request details for debugging
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // CRITICAL: Get token using tokenStorage utility (single source of truth)
  // This interceptor MUST add Authorization header to all requests
  // Without this, no protected API endpoints will work
  
  // Check if this is an auth endpoint (login/register/refresh)
  // These endpoints should NOT have Authorization header
  const url = config.url || '';
  const requestFullUrl = (config.baseURL || '') + url;
  const isAuthEndpoint = url.includes('/auth/login') || 
                        url.includes('/auth/register') ||
                        url.includes('/auth/refresh') ||
                        requestFullUrl.includes('/auth/login') ||
                        requestFullUrl.includes('/auth/register') ||
                        requestFullUrl.includes('/auth/refresh');
  
  // Only add Authorization header if:
  // 1. Token exists
  // 2. NOT an auth endpoint (login/register/refresh don't need tokens)
  const token = getAccessToken();
  const headersAny = (config.headers || {}) as any;
  const hasHeaderSetFn = typeof headersAny.set === 'function';
  const hasHeaderGetFn = typeof headersAny.get === 'function';
  const hasHeaderDeleteFn = typeof headersAny.delete === 'function';

  const getHeaderValue = (name: string): string | undefined => {
    if (hasHeaderGetFn) {
      const v = headersAny.get(name);
      return v == null ? undefined : String(v);
    }
    const direct = headersAny[name] ?? headersAny[name.toLowerCase()];
    return direct == null ? undefined : String(direct);
  };
  
  if (token && !isAuthEndpoint) {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as any;
    }
    // Set Authorization header (supports AxiosHeaders and plain objects)
    if (hasHeaderSetFn) {
      headersAny.set('Authorization', `Bearer ${token}`);
    } else {
      (config.headers as any) = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
    if (API_VERBOSE_DEBUG) {
      console.log('[API] Authorization header added', { url: config.url });
    }
  } else if (token && isAuthEndpoint) {
    // IMPORTANT: Don't add Authorization header to auth endpoints
    // This can cause 401 errors if the token is invalid
    // Also, explicitly remove any existing Authorization header
    if (config.headers) {
      if (hasHeaderDeleteFn) {
        headersAny.delete('Authorization');
        headersAny.delete('authorization');
      } else {
        delete (config.headers as any).Authorization;
        delete (config.headers as any).authorization;
      }
    }
    if (API_VERBOSE_DEBUG) {
      console.log('[API] Skipping Authorization for auth endpoint', { url: config.url });
    }
  } else if (!token && !isAuthEndpoint) {
    // This is a protected endpoint that needs a token
    const warnKey = `${config.method || 'get'}:${requestFullUrl}`;
    if (!unauthenticatedWarnedUrls.has(warnKey)) {
      unauthenticatedWarnedUrls.add(warnKey);
      console.warn('[API] Request without token skipped/unauthenticated', {
        url: config.url,
        fullURL: requestFullUrl,
      });
    }
  } else {
    // For auth endpoints without token - this is normal
    // Silently skip - no warning needed
  }
  
  // FormData: let the browser set multipart boundary (do not force application/json)
  if (config.data instanceof FormData) {
    if (hasHeaderDeleteFn) {
      headersAny.delete('Content-Type');
    } else {
      delete (config.headers as any)['Content-Type'];
    }
  } else if (!getHeaderValue('Content-Type')) {
    // Don't override Content-Type if it's already set (e.g., for form-urlencoded in login)
    if (hasHeaderSetFn) {
      headersAny.set('Content-Type', 'application/json');
    } else {
      (config.headers as any)['Content-Type'] = 'application/json';
    }
  }
  
  // Log request details for debugging (always log in dev, log token status in prod)
  const logFullUrl = config.baseURL + (config.url || '');
  
  // Special logging for register endpoint to debug email/password issues
  if (isAuthEndpoint && url.includes('/auth/register')) {
    let email = '';
    let password = '';
    
    // Try to extract email and password from request data
    if (config.data) {
      if (typeof config.data === 'string') {
        // If it's a string, try to parse as JSON
        try {
          const parsed = JSON.parse(config.data);
          email = parsed.email || '';
          password = parsed.password ? '***' : '';
        } catch (e) {
          // Not JSON, might be form-urlencoded
          email = config.data.includes('email=') ? 'found in string' : '';
        }
      } else if (typeof config.data === 'object' && config.data !== null && !Array.isArray(config.data)) {
        const body = config.data as Record<string, unknown>;
        email = typeof body.email === 'string' ? body.email : '';
        password = body.password != null && body.password !== '' ? '***' : '';
      }
    }
    
    if (API_VERBOSE_DEBUG) {
      console.log('[API] Register payload:', {
        email: email || 'EMPTY/MISSING',
        hasEmail: !!email,
        emailLength: email ? email.length : 0,
        hasPassword: !!password,
        passwordLength: password ? '***' : 0,
        dataType: typeof config.data,
      });
    }
  }
  
  if (API_VERBOSE_DEBUG) {
    console.log('[API] Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      fullURL: logFullUrl,
      hasToken: !!token,
      hasAuthHeader: !!getHeaderValue('Authorization'),
      isAuthEndpoint: isAuthEndpoint,
    });
  }

  // Focused auth debug for protected endpoints that frequently return 401.
  const isProtectedDebugEndpoint =
    url.includes('/tasks') || url.includes('/rooms') || url.includes('/auth/me');
  if (isProtectedDebugEndpoint) {
    const authHeader = getHeaderValue('Authorization');
    if (API_VERBOSE_DEBUG) {
      console.log('[API][AUTH-DEBUG] Protected request details:', {
        endpoint: url,
        fullURL: logFullUrl,
        tokenInStorage: !!token,
        authHeaderAttached: !!authHeader,
      });
    }
  }
  
  return config;
}, (error) => {
  logAxiosError(error, 'Request interceptor');
  return Promise.reject(error);
});

/**
 * Response Interceptor
 * 
 * Handles:
 * - Automatic token refresh on 401 errors
 * - Token storage management
 * - Request queueing during token refresh
 * - Error logging
 * 
 * Flow:
 * 1. On 401 error → Check if refresh token exists
 * 2. If exists → Call /api/auth/refresh
 * 3. Save new tokens → Retry original request
 * 4. If refresh fails → Clear tokens → Redirect to login
 */
api.interceptors.response.use(
  (response) => {
    // Handle 204 No Content responses (empty body)
    // 204 responses have no body, so response.data will be empty string or null
    if (response.status === 204) {
      // Set default empty object for 204 responses to prevent errors
      // This ensures response.data is always an object (not empty string/null)
      if (!response.data || response.data === '' || response.data === null) {
        response.data = {};
      }
      if (import.meta.env.DEV) {
        console.log('[API] 204 No Content response handled:', {
          status: response.status,
          url: response.config.url,
          fullURL: response.config.baseURL + (response.config.url || ''),
          note: 'Response body is empty (204 No Content)',
        });
      }
      return response;
    }
    
    // Handle other empty responses (status 200-299 but no data)
    // Some endpoints may return 200 OK with empty body
    if (response.status >= 200 && response.status < 300) {
      // If data is empty string, null, or undefined, set to empty object
      if (response.data === '' || response.data === null || response.data === undefined) {
        response.data = {};
        if (import.meta.env.DEV) {
          console.log('[API] Empty response body handled:', {
            status: response.status,
            url: response.config.url,
            note: 'Response body was empty, set to {}',
          });
        }
      }
    }
    
    // Log successful responses only in explicit verbose debug mode.
    if (API_VERBOSE_DEBUG) {
      console.log('[API] Response:', {
        status: response.status,
        url: response.config.url,
        fullURL: response.config.baseURL + (response.config.url || ''),
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Check for network/server errors first
    const isNetworkError = error.code === 'ERR_NETWORK' || error.code === 'ERR_FAILED';
    const isServerDown = !error.response && (isNetworkError || error.message?.includes('Failed'));
    
    if (isServerDown) {
      // Server is not reachable - provide helpful error message
      const fullUrl = error.config?.baseURL
        ? `${error.config.baseURL}${error.config.url || ''}`
        : error.config?.url || 'unknown';
      console.error(`[API] Server unreachable: ${fullUrl}`, {
        code: error.code,
        message: error.message,
        hint: 'Make sure the backend server is running on http://localhost:8000',
      });
      // Don't log full error for network failures - already logged above
      // Continue to handle 401 refresh logic below
    }
    
    // Only log errors that are not handled or are unexpected
    // Skip logging for:
    // - 401 errors that will be handled by token refresh (unless already retried)
    // - Auth endpoint errors (login/register/refresh) - these are expected
    // - Network errors (already logged above)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || 
                          originalRequest?.url?.includes('/auth/register') ||
                          originalRequest?.url?.includes('/auth/refresh');
    const is401WillRefresh = error.response?.status === 401 && 
                            originalRequest && 
                            !originalRequest._retry && 
                            !isAuthEndpoint;
    
    // Log only if:
    // 1. Not a 401 that will be refreshed, AND
    // 2. Not a network/server error (already logged), AND
    // 3. Not an auth endpoint error, AND
    // 4. Not a 404 on inventory endpoints (might be expected if no data exists yet)
    // Check both with and without /api prefix since URL might be relative
    const inventoryUrl = originalRequest?.url || '';
    const fullUrl = error.config?.baseURL
      ? `${error.config.baseURL}${inventoryUrl}`
      : inventoryUrl;
    const isInventory404 = error.response?.status === 404 && 
                          (inventoryUrl.includes('/inventory/') || 
                           inventoryUrl.includes('inventory/areas') || 
                           inventoryUrl.includes('inventory/items') ||
                           fullUrl.includes('/inventory/') ||
                           fullUrl.includes('inventory/areas') ||
                           fullUrl.includes('inventory/items'));
    const shouldLog = !is401WillRefresh && !isServerDown && !isInventory404;
    
    if (shouldLog) {
      // Log with more context for debugging
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: originalRequest?.url,
        method: originalRequest?.method?.toUpperCase(),
        message: error.message,
        code: error.code,
      };
      if (import.meta.env.DEV) {
        console.error(`[API] Response interceptor error:`, errorDetails);
        console.error(`[API] Full error:`, error);
      }
      logAxiosError(error, 'Response interceptor');
    } else if (isInventory404 && import.meta.env.DEV) {
      // Log 404 on inventory in dev mode for debugging, but don't treat as error
      console.warn(`[API] Inventory endpoint returned 404 (might be expected): ${originalRequest?.url}`);
    } else if (isInventory404 && !import.meta.env.DEV) {
      // In production, silently skip 404 on inventory (expected when no data exists)
      // No logging needed
    }

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for auth endpoints (login, register, refresh)
      const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || 
                            originalRequest.url?.includes('/auth/register') ||
                            originalRequest.url?.includes('/auth/refresh');
      
      if (isAuthEndpoint) {
        // For auth endpoints, don't try to refresh - just reject the error.
        // IMPORTANT: Do NOT clear existing tokens on /auth/login or /auth/register 401,
        // otherwise a temporary/auth-form failure can wipe a valid session.
        const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');
        console.log('[API] 401 on auth endpoint - skipping refresh:', {
          url: originalRequest.url,
          isRefreshEndpoint,
        });

        // Only refresh endpoint failure should clear session state.
        if (isRefreshEndpoint) {
          clearTokens();
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            showError(i18n.t('errors:sessionExpired'));
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }

      // Prevent multiple simultaneous refresh requests
      if (isRefreshing) {
        // Queue this request to retry after refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        // No refresh token - clear everything and redirect to login
        console.log('[API] No refresh token available - cannot refresh');
        clearTokens();
        processQueue(error, null);
        isRefreshing = false;
        
        // טיפול ב-401 עם toast
        // IMPORTANT: Don't redirect if we're on register page - let the page handle the error
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          showError(i18n.t('errors:sessionExpired'));
          window.location.href = '/login';
        } else {
          // If we're on register/login page, just reject the error without redirect
          console.log('[API] On register/login page - not redirecting');
        }
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh tokens
        // POST /api/auth/refresh with { refresh_token: "..." }
        console.log('[API] Attempting to refresh tokens...', {
          hasRefreshToken: !!refreshToken,
          refreshTokenLength: refreshToken.length,
        });
        
        // Build refresh URL - use `api` instance so baseURL (/api) and Vite proxy are applied
        const response = await api.post(
          '/auth/refresh',
          { refresh_token: refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('[API] Refresh response received:', {
          status: response.status,
          hasAccessToken: !!response.data?.access_token,
          hasRefreshToken: !!response.data?.refresh_token,
        });

        const { access_token, refresh_token } = response.data;
        
        if (!access_token) {
          throw new Error('No access_token in refresh response');
        }

        // Save new tokens
        setTokens(access_token, refresh_token);
        console.log('[API] New tokens saved, retrying original request...');
        
        // Update Authorization header for original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }

        // Process queued requests with new token
        processQueue(null, access_token);
        isRefreshing = false;

        // Retry original request with new token
        console.log('[API] Retrying original request:', {
          method: originalRequest.method,
          url: originalRequest.url,
        });
        return api(originalRequest);
      } catch (refreshError: any) {
        // Refresh failed - clear tokens and redirect to login
        logAxiosError(refreshError, 'Token refresh failed');
        
        clearTokens();
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // טיפול ב-401 עם toast
        // IMPORTANT: Don't redirect if we're on register page - let the page handle the error
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          showError(i18n.t('errors:sessionExpired'));
          window.location.href = '/login';
        } else {
          // If we're on register/login page, just reject the error without redirect
          console.log('[API] On register/login page - not redirecting after refresh failure');
        }
        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);

/**
 * Unified "Who am I" function
 * 
 * Single source of truth for fetching current user data.
 * All components should use this function instead of calling api.get('/api/auth/me') directly.
 * 
 * @returns Promise with user data from /api/auth/me
 */
export const fetchMe = () => api.get("/auth/me");

/**
 * Get today's daily reset task
 * 
 * @returns Promise with daily reset data including the selected task
 */
export const getDailyReset = () => api.get("/daily-reset/today");

/** Dashboard progress + streak (UTC-based counts on server). */
export const getProgressSummary = (range: "week" | "month" = "week") =>
  api.get<ProgressSummaryRead>("/progress/summary", {
    params: { range },
  });

/** Deterministic daily inspiration (same quote all day; server calendar date). */
export const getDailyInspiration = (lang: "he" | "en" = "he") =>
  api.get<DailyInspirationRead>("/dashboard/daily-inspiration", { params: { lang } });

/** Rule-based daily tip (stable for the day; personalized from DB context). */
export const getDailyTip = (lang: "he" | "en" = "he") =>
  api.get<DailyTipRead>("/dashboard/daily-tip", { params: { lang } });

/** Per-user vision board (GET returns friendly defaults when no row exists). */
export const getVisionBoard = (lang: "he" | "en" = "he") =>
  api.get<VisionBoardRead>("/vision-board", { params: { lang } });

export const putVisionBoard = (body: VisionBoardUpdate) =>
  api.put<VisionBoardRead>("/vision-board", body);

export default api;
