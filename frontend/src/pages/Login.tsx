import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import api, { fetchMe } from '../api.ts';
import { ROUTES } from '../utils/routes';
import { showSuccess, showError } from '../utils/toast';
import { setTokens, clearTokens, getAccessToken } from '../utils/tokenStorage';
import '../styles/Auth.css';
import { useTranslation } from "react-i18next";
import { smokeDebug } from "../utils/smokeDebug";

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
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        googleFail: "Google login is unavailable right now. Please try again.",
        emailRequired: "Please enter your email address.",
        emailInvalid: "Email address is invalid.",
        passwordRequired: "Please enter a password.",
        genericFail: "We couldn't sign you in. Please try again.",
        noAccessToken: "Unable to complete sign-in right now.",
        storageFail: "Unable to save sign-in details in this browser.",
        fallbackUser: "User",
        welcome: (name: string) => `Welcome ${name}`,
        badCredentials: "Email or password is incorrect.",
        serverFail: "Temporary server issue. Please try again shortly.",
        badInput: "The provided details are invalid.",
        networkFail: "Unable to reach the server. Please try again shortly.",
        noResponse: "No response from server right now. Please try again shortly.",
        tempFail: "A temporary error occurred. Please try again.",
        title: "Welcome back",
        subtitle: "Continue building a calmer, more organized home.",
        email: "Email",
        password: "Password",
        loggingIn: "Signing in...",
        login: "Sign in",
        loginWithGoogle: "Sign in with Google",
        noAccount: "Don't have an account?",
        register: "Register",
      }
    : {
        googleFail: "לא הצלחנו להתחבר ל-Google כרגע. נסו שוב.",
        emailRequired: "נא להזין כתובת אימייל.",
        emailInvalid: "כתובת האימייל אינה תקינה.",
        passwordRequired: "נא להזין סיסמה.",
        genericFail: "לא הצלחנו להתחבר. נסו שוב.",
        noAccessToken: "לא ניתן להשלים את ההתחברות כרגע.",
        storageFail: "לא ניתן לשמור את פרטי ההתחברות בדפדפן.",
        fallbackUser: "משתמש",
        welcome: (name: string) => `ברוך הבא ${name}`,
        badCredentials: "האימייל או הסיסמה אינם נכונים.",
        serverFail: "יש תקלה זמנית בשרת. נסו שוב בעוד רגע.",
        badInput: "הפרטים שהוזנו אינם תקינים.",
        networkFail: "לא הצלחנו להגיע לשרת כרגע. נסו שוב בעוד רגע.",
        noResponse: "לא התקבלה תשובה מהשרת כרגע. נסו שוב בעוד רגע.",
        tempFail: "אירעה תקלה זמנית. נסו שוב.",
        title: "ברוכה הבאה",
        subtitle: "התחילי ליצור בית רגוע ומסודר.",
        email: "דוא\"ל",
        password: "סיסמה",
        loggingIn: "מתחבר...",
        login: "התחברות",
        loginWithGoogle: "התחברות עם Google",
        noAccount: "אין לך חשבון?",
        register: "להרשמה",
      };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoogleLogin = async () => {
    try {
      const { data } = await api.get('/auth/google/login');
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
      showError(text.googleFail);
    } catch (error) {
      logAxios(error, '[Login] Google login init failed');
      showError(text.googleFail);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email before proceeding
    if (!email || !email.trim()) {
      const errorMsg = text.emailRequired;
      setError(errorMsg);
      showError(errorMsg);
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const errorMsg = text.emailInvalid;
      setError(errorMsg);
      showError(errorMsg);
      return;
    }
    
    if (!password || password.length === 0) {
      const errorMsg = text.passwordRequired;
      setError(errorMsg);
      showError(errorMsg);
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      /**
       * Login uses OAuth2PasswordRequestForm (OAuth2 standard)
       * 
       * Content-Type: application/x-www-form-urlencoded
       * Body: username=<email>&password=<password>
       */
      const params = new URLSearchParams();
      params.append('username', email.trim()); // OAuth2 uses 'username' field (not 'email')
      params.append('password', password);

      const response = await api.post('/auth/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).catch((error) => {
        logAxios(error, '[Login] ❌ Login request failed');
        throw error;
      });

      smokeDebug("login:response", {
        status: response.status,
        hasAccessToken: !!response.data?.access_token,
        hasRefreshToken: !!response.data?.refresh_token,
      });

      // Backend returns JSON with: { access_token, refresh_token, token_type, expires_in }
      const { access_token, refresh_token } = response.data || {};

      if (!access_token) {
        console.error('[Login] No access_token in response!', response.data);
        throw new Error(text.noAccessToken);
      }

      // Save tokens using tokenStorage utility
      try {
        setTokens(access_token, refresh_token);
        smokeDebug("login:tokens_saved", {
          accessLen: access_token.length,
          refreshLen: refresh_token?.length ?? 0,
        });
      } catch (storageError) {
        console.error('[Login] Error saving tokens:', storageError);
        throw new Error(text.storageFail);
      }

      /**
       * Verify token and redirect
       */
      // Guard: never call /auth/me if token is missing from storage
      const savedToken = getAccessToken();
      if (!savedToken) {
        throw new Error(text.noAccessToken);
      }
      
      smokeDebug("login:before_fetchMe", { tokenLen: savedToken.length });

      // Verify token with backend and get user info
      const meResponse = await fetchMe();

      smokeDebug("login:after_fetchMe", {
        status: meResponse.status,
        userId: meResponse.data?.id,
        email: meResponse.data?.email,
      });
      
      // If we get here, token is valid
      const user = meResponse.data;
      const userName = user?.full_name || user?.email || text.fallbackUser;
      
      // הודעת "ברוך הבא" אחרי login
      showSuccess(text.welcome(userName));
      
      // Update global auth state
      window.dispatchEvent(new Event('token-changed'));
      
      // Small delay before navigation for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirect back to originally requested page if available
      const from = (location.state as { from?: string })?.from ?? ROUTES.HOME;
      smokeDebug("login:navigate", { to: from });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      logAxios(err, '[Login] ❌ Login error details');
      
      // Clear tokens ONLY if the server explicitly says unauthorized (401)
      // Do NOT clear on 404 / 500 / network errors — the token may still be valid
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        clearTokens();
      }
      
      // Enhanced error handling
      let errorMessage = text.genericFail;
      
      if (axios.isAxiosError(err) && err.response) {
        // Server responded with error
        const statusCode = err.response.status;
        const responseData = err.response.data;
        
        if (statusCode === 401) {
          errorMessage = responseData?.detail || text.badCredentials;
        } else if (statusCode === 500) {
          errorMessage = text.serverFail;
          console.error('[Login] ⚠️ Server error (500) - check backend logs');
        } else if (statusCode === 400) {
          errorMessage = responseData?.detail || text.badInput;
        } else if (statusCode === 0 || !statusCode) {
          errorMessage = text.networkFail;
        } else {
          errorMessage = responseData?.detail || responseData?.message || text.tempFail;
        }
      } else if (axios.isAxiosError(err) && err.request) {
        // Request was made but no response received
        errorMessage = text.noResponse;
        console.error('[Login] ⚠️ No response from server - is backend running?');
      } else {
        // Something else happened
        errorMessage = err instanceof Error ? err.message : errorMessage;
      }
      
      // Show error
      console.error('[Login] Error message to display:', errorMessage);
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrap" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="wow-card wow-pad wow-fadeIn" style={{ maxWidth: 420, width: "100%", margin: "60px auto" }}>
        <div className="wow-title" style={{ fontSize: 30, marginBottom: 8 }}>{text.title}</div>
        <div className="wow-muted">
          {text.subtitle}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="authForm">
          <div>
            <label className="label text-right">
              {text.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="label text-right">
              {text.password}
            </label>
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
              {loading ? text.loggingIn : text.login}
            </button>
            <button type="button" onClick={handleGoogleLogin} className="wow-btn">
              {text.loginWithGoogle}
            </button>
          </div>
        </form>

        <div className="authFooter">
          {text.noAccount}{" "}
          <Link to={ROUTES.REGISTER}>
            {text.register}
          </Link>
        </div>
      </div>
    </div>
  );
}
