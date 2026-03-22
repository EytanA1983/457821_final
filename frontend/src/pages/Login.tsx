import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import api, { fetchMe } from "../api.ts";
import {
  DASHBOARD_QUERY_STALE_MS,
  fetchDashboardProgressWeek,
  fetchDashboardTasksFullList,
} from "../api/dashboardBootstrap";
import { ROUTES } from "../utils/routes";
import { showSuccess, showError } from "../utils/toast";
import { setTokens, clearTokens, getAccessToken } from "../utils/tokenStorage";
import "../styles/Auth.css";
import { useTranslation } from "react-i18next";
import { smokeDebug } from "../utils/smokeDebug";
import { isRtlLang } from "../utils/localeDirection";

function logAxios(err: unknown, label: string) {
  if (axios.isAxiosError(err)) {
    const fullUrl = err.config?.baseURL
      ? `${err.config.baseURL}${err.config.url || ""}`
      : err.config?.url;
    console.error(label, {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      data: err.response?.data,
      url: fullUrl,
      method: err.config?.method,
    });
    return;
  }
  console.error(label, err);
}

export default function Login() {
  const { t, i18n } = useTranslation(["auth", "validation"]);
  const lang = i18n.resolvedLanguage || i18n.language;
  const rtl = isRtlLang(lang);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleGoogleLogin = async () => {
    try {
      const { data } = await api.get("/auth/google/login");
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
      showError(t("auth:google_unavailable"));
    } catch (error) {
      logAxios(error, "[Login] Google login init failed");
      showError(t("auth:google_unavailable"));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.trim()) {
      const errorMsg = t("auth:email_required");
      setError(errorMsg);
      showError(errorMsg);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const errorMsg = t("validation:email_invalid");
      setError(errorMsg);
      showError(errorMsg);
      return;
    }

    if (!password || password.length === 0) {
      const errorMsg = t("auth:password_required");
      setError(errorMsg);
      showError(errorMsg);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("username", email.trim());
      params.append("password", password);

      const response = await api
        .post("/auth/login", params.toString(), {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .catch((error) => {
          logAxios(error, "[Login] ❌ Login request failed");
          throw error;
        });

      smokeDebug("login:response", {
        status: response.status,
        hasAccessToken: !!response.data?.access_token,
        hasRefreshToken: !!response.data?.refresh_token,
      });

      const { access_token, refresh_token } = response.data || {};

      if (!access_token) {
        console.error("[Login] No access_token in response!", response.data);
        throw new Error(t("auth:no_access_token"));
      }

      try {
        setTokens(access_token, refresh_token);
        smokeDebug("login:tokens_saved", {
          accessLen: access_token.length,
          refreshLen: refresh_token?.length ?? 0,
        });
      } catch (storageError) {
        console.error("[Login] Error saving tokens:", storageError);
        throw new Error(t("auth:storage_failed"));
      }

      const savedToken = getAccessToken();
      if (!savedToken) {
        throw new Error(t("auth:no_access_token"));
      }

      smokeDebug("login:before_fetchMe", { tokenLen: savedToken.length });

      const meResponse = await fetchMe();

      smokeDebug("login:after_fetchMe", {
        status: meResponse.status,
        userId: meResponse.data?.id,
        email: meResponse.data?.email,
      });

      const user = meResponse.data;
      const userName = user?.full_name || user?.email || t("auth:fallback_user");

      showSuccess(t("auth:welcome_user", { name: userName }));

      const rawId = user?.id;
      const uid =
        typeof rawId === "number"
          ? rawId
          : typeof rawId === "string"
            ? Number.parseInt(rawId, 10)
            : NaN;

      queryClient.clear();

      if (Number.isFinite(uid)) {
        try {
          await Promise.all([
            queryClient.prefetchQuery({
              queryKey: ["progress", "summary", "week", uid],
              queryFn: fetchDashboardProgressWeek,
              staleTime: DASHBOARD_QUERY_STALE_MS,
            }),
            // Must match `useTasks(undefined)` → queryKey: ["tasks", undefined] so Home ("/") chart/tasks hydrate from cache.
            queryClient.prefetchQuery({
              queryKey: ["tasks", undefined],
              queryFn: fetchDashboardTasksFullList,
              staleTime: DASHBOARD_QUERY_STALE_MS,
            }),
          ]);
        } catch (prefetchErr) {
          console.warn("[Login] Dashboard prefetch failed (non-fatal):", prefetchErr);
        }
      }

      window.dispatchEvent(new Event("token-changed"));

      const from = (location.state as { from?: string })?.from ?? ROUTES.HOME;
      smokeDebug("login:navigate", { to: from });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      logAxios(err, "[Login] ❌ Login error details");

      if (axios.isAxiosError(err) && err.response?.status === 401) {
        clearTokens();
      }

      let errorMessage = t("auth:sign_in_failed");

      if (axios.isAxiosError(err) && err.response) {
        const statusCode = err.response.status;
        const responseData = err.response.data;

        if (statusCode === 401) {
          errorMessage = responseData?.detail || t("auth:invalid_credentials");
        } else if (statusCode === 500) {
          errorMessage = t("auth:server_error_temp");
          console.error("[Login] ⚠️ Server error (500) - check backend logs");
        } else if (statusCode === 400) {
          errorMessage = responseData?.detail || t("auth:bad_input");
        } else if (statusCode === 0 || !statusCode) {
          errorMessage = t("auth:network_unreachable");
        } else {
          errorMessage = responseData?.detail || responseData?.message || t("auth:temp_error");
        }
      } else if (axios.isAxiosError(err) && err.request) {
        errorMessage = t("auth:no_server_response");
        console.error("[Login] ⚠️ No response from server - is backend running?");
      } else {
        errorMessage = err instanceof Error ? err.message : errorMessage;
      }

      console.error("[Login] Error message to display:", errorMessage);
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrap" dir={rtl ? "rtl" : "ltr"}>
      <div className="wow-card wow-pad wow-fadeIn" style={{ maxWidth: 420, width: "100%", margin: "60px auto" }}>
        <div className="wow-title" style={{ fontSize: 30, marginBottom: 8 }}>
          {t("auth:login_page_title")}
        </div>
        <div className="wow-muted">{t("auth:login_page_subtitle")}</div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="authForm">
          <div>
            <label className="label text-right">{t("auth:email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder={t("auth:email_placeholder")}
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="label text-right">{t("auth:password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="authActions">
            <button type="submit" disabled={loading} className="wow-btn wow-btnPrimary">
              {loading ? t("auth:signing_in") : t("auth:sign_in_button")}
            </button>
            <button type="button" onClick={handleGoogleLogin} className="wow-btn">
              {t("auth:sign_in_google")}
            </button>
          </div>
        </form>

        <div className="authFooter">
          {t("auth:dont_have_account")}{" "}
          <Link to={ROUTES.REGISTER}>{t("auth:register")}</Link>
        </div>
      </div>
    </div>
  );
}
