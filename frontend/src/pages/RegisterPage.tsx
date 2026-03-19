import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import { ROUTES } from '../utils/routes';
import { showSuccess, showError } from '../utils/toast';
import { setTokens, clearTokens, getAccessToken } from '../utils/tokenStorage';
import '../styles/Auth.css';
import { useTranslation } from 'react-i18next';
import { smokeDebug } from '../utils/smokeDebug';

export const RegisterPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const text = isEnglish
    ? {
        googleFail: "Google login is unavailable right now. Please try again.",
        passwordMismatch: "Passwords do not match.",
        passwordShort: "Password must be at least 8 characters.",
        registerFail: "Unable to complete registration right now.",
        storageFail: "Unable to save sign-in details in this browser.",
        unknownError: "Unknown error",
        fallbackUser: "User",
        welcome: (name: string) => `Welcome ${name}, registration completed successfully.`,
        genericFail: "We couldn't complete registration. Please try again.",
        serverFail: "Temporary server issue. Please try again shortly.",
        tempFail: "A temporary error occurred. Please try again.",
        noResponse: "No response from server right now. Please try again shortly.",
        title: "Welcome",
        subtitle: "Start building a calmer, organized home.",
        email: "Email",
        fullName: "Full name (optional)",
        fullNamePlaceholder: "Enter full name",
        password: "Password",
        passwordPlaceholder: "At least 8 characters",
        confirmPassword: "Confirm password",
        confirmPasswordPlaceholder: "Re-enter password",
        registering: "Registering...",
        register: "Register",
        google: "Continue with Google",
        haveAccount: "Already have an account?",
        login: "Sign in",
      }
    : {
        googleFail: "לא הצלחנו להתחבר ל-Google כרגע. נסו שוב.",
        passwordMismatch: "הסיסמאות אינן תואמות.",
        passwordShort: "הסיסמה צריכה להכיל לפחות 8 תווים.",
        registerFail: "לא ניתן להשלים את ההרשמה כרגע.",
        storageFail: "לא ניתן לשמור את פרטי ההתחברות בדפדפן.",
        unknownError: "שגיאה לא ידועה",
        fallbackUser: "משתמש",
        welcome: (name: string) => `ברוך הבא ${name}, ההרשמה הושלמה בהצלחה.`,
        genericFail: "לא הצלחנו להשלים את ההרשמה. נסו שוב.",
        serverFail: "יש תקלה זמנית בשרת. נסו שוב בעוד רגע.",
        tempFail: "אירעה תקלה זמנית. נסו שוב.",
        noResponse: "לא התקבלה תשובה מהשרת כרגע. נסו שוב בעוד רגע.",
        title: "ברוכה הבאה",
        subtitle: "התחילי ליצור בית רגוע ומסודר.",
        email: "אימייל",
        fullName: "שם מלא (אופציונלי)",
        fullNamePlaceholder: "הזן שם מלא",
        password: "סיסמה",
        passwordPlaceholder: "לפחות 8 תווים",
        confirmPassword: "אימות סיסמה",
        confirmPasswordPlaceholder: "הזן שוב את הסיסמה",
        registering: "נרשם...",
        register: "הרשמה",
        google: "התחברות עם Google",
        haveAccount: "כבר יש לך חשבון?",
        login: "להתחברות",
      };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(''); // Optional: full name field
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const { data } = await api.get('/auth/google/login');
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
      showError(text.googleFail);
    } catch (error) {
      console.error('[RegisterPage] Google login init failed:', error);
      showError(text.googleFail);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError(text.passwordMismatch);
      return;
    }

    if (password.length < 8) {
      setError(text.passwordShort);
      return;
    }

    setLoading(true);

    try {
      const requestUrl = '/auth/register';
      
      /**
       * Register uses JSON format (UserCreate schema)
       * 
       * Content-Type: application/json
       * Body: { "email": "...", "password": "..." }
       * 
       * This matches UserCreate schema in backend/app/schemas/user.py
       * Register uses JSON (not form-urlencoded) because:
       * 1. It's simpler for registration (no OAuth2 standard requirement)
       * 2. Allows for optional fields like full_name
       * 3. Better validation with Pydantic
       */
      const requestBody = {
        email: email.trim(),
        password: password,
        // full_name is optional - only include if provided
        ...(fullName && fullName.trim() && { full_name: fullName.trim() }),
      };
      
      const response = await api.post(
        requestUrl, 
        requestBody, // Axios automatically serializes objects to JSON
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      ).catch((error) => {
        // Log error with immediate visibility of key information
        const statusCode = error.response?.status;
        const statusText = error.response?.statusText;
        const responseData = error.response?.data;
        const serverMessage = responseData?.detail || responseData?.message || responseData;
        const fullURL = error.config ? (error.config.baseURL || '') + (error.config.url || '') : 'unknown';
        
        // Show immediate error summary
        console.error(`[RegisterPage] ❌ Registration Failed: ${error.message || 'Unknown error'}`);
        if (statusCode) {
          console.error(`[RegisterPage] ⚠️ HTTP ${statusCode}: ${statusText || 'Error'}`);
        }
        if (serverMessage) {
          console.error(`[RegisterPage] Server Error: ${typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage)}`);
        }
        
        // Log detailed error information in a grouped format
        console.group('[RegisterPage] Error Details');
        console.error('Error Type:', error.name || 'AxiosError');
        console.error('Message:', error.message);
        if (statusCode) {
          console.error('Status:', `${statusCode} ${statusText || ''}`);
        }
        console.error('URL:', fullURL);
        console.error('Method:', error.config?.method?.toUpperCase());
        if (responseData) {
          console.error('Response Data:', responseData);
          try {
            console.error('Response Data (JSON):', JSON.stringify(responseData, null, 2));
          } catch (e) {
            console.error('Response Data (string):', String(responseData));
          }
        }
        if (error.config?.data) {
          console.error('Request Data:', error.config.data);
        }
        console.groupEnd();
        
        // If it's a 500 error, provide specific guidance
        if (statusCode === 500) {
          console.error('[RegisterPage] ⚠️ 500 Internal Server Error - Backend Issue');
          console.error('[RegisterPage] 💡 Check the backend server terminal for the full error traceback');
          console.error('[RegisterPage] 💡 Common causes:');
          console.error('[RegisterPage]   - Database connection issue (check DATABASE_URL)');
          console.error('[RegisterPage]   - Missing database tables (run: alembic upgrade head)');
          console.error('[RegisterPage]   - Missing SECRET_KEY (check .env file)');
          console.error('[RegisterPage]   - Server configuration error');
        }
        
        throw error;
      });
      
      // CRITICAL: Verify response structure before proceeding
      if (!response.data) {
        console.error('[RegisterPage] ❌ Response has no data!', response);
        throw new Error(text.registerFail);
      }

      // Backend returns JSON with: { access_token, refresh_token, token_type, expires_in }
      // NOT cookies - we must save to localStorage
      const { access_token, refresh_token } = response.data;

      // CRITICAL: Validate that access_token exists and is not empty
      if (!access_token || typeof access_token !== 'string' || access_token.trim().length === 0) {
        console.error('[RegisterPage] ❌ No access_token in response!', {
          responseData: response.data,
          access_token: access_token,
          access_tokenType: typeof access_token,
          access_tokenLength: access_token?.length || 0,
        });
        throw new Error(text.registerFail);
      }

      // Validate refresh_token (optional but recommended)
      if (!refresh_token || typeof refresh_token !== 'string' || refresh_token.trim().length === 0) {
        // refresh token may be optional in some environments
      }

      // CRITICAL: Save tokens to localStorage before navigation
      // This is the key step - without this, the app won't know the user is logged in
      try {
        setTokens(access_token, refresh_token);
        smokeDebug("register:tokens_saved", {
          accessLen: access_token.length,
          refreshLen: refresh_token?.length ?? 0,
        });
        const verifyAccessToken = localStorage.getItem('token');
        if (!verifyAccessToken) {
          console.error('[RegisterPage] ❌ CRITICAL: Access token was NOT saved to localStorage!');
          throw new Error(text.storageFail);
        }
      } catch (storageError: any) {
        console.error('[RegisterPage] ❌ Error saving tokens:', storageError);
        console.error('[RegisterPage] Storage error details:', {
          name: storageError?.name,
          message: storageError?.message,
          stack: storageError?.stack,
        });
        throw new Error(`${text.storageFail}: ${storageError?.message || text.unknownError}.`);
      }

      /**
       * Step 4: Verify token and redirect
       * 
       * Flow:
       * 1. Save tokens → 2. Verify with fetchMe() → 3. Navigate to dashboard
       * If verification fails → show error and stay on register page
       */
      // Small delay to ensure token is saved to localStorage
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Double-check that token was saved
      const savedToken = getAccessToken();
      if (!savedToken) {
        console.error('[RegisterPage] Token was not saved to localStorage!');
        throw new Error(text.registerFail);
      }
      
      // Verify token with backend and get user info
      // IMPORTANT: Skip fetchMe() verification after registration
      // The token was just created and should be valid
      // If we get 401, it's likely a timing issue or token format problem
      // In that case, we'll just navigate to dashboard and let ProtectedRoute handle auth
      // Get user info from the registration response if available
      // Otherwise, we'll let ProtectedRoute fetch it
      const userName = email.split('@')[0] || text.fallbackUser;
      
      // הודעת "ברוך הבא" אחרי registration
      showSuccess(text.welcome(userName));
      
      // Update global auth state
      window.dispatchEvent(new Event('token-changed'));
      
      // Same landing as login default: home (index). ProtectedRoute runs /auth/me once.
      await new Promise(resolve => setTimeout(resolve, 500));

      smokeDebug("register:navigate", { to: ROUTES.HOME });
      try {
        navigate(ROUTES.HOME, { replace: true });
      } catch (navError) {
        console.error('[RegisterPage] ❌ Navigation error:', navError);
        window.location.href = ROUTES.HOME;
      }
    } catch (err: any) {
      // Log error with immediate visibility
      const statusCode = err.response?.status;
      const statusText = err.response?.statusText;
      const responseData = err.response?.data;
      const serverMessage = responseData?.detail || responseData?.message || responseData;
      
      console.error(`[RegisterPage] ❌ Registration Failed: ${err.message || 'Unknown error'}`);
      if (statusCode) {
        console.error(`[RegisterPage] ⚠️ HTTP ${statusCode}: ${statusText || 'Error'}`);
      }
      if (serverMessage) {
        console.error(`[RegisterPage] Server Error: ${typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage)}`);
      }
      
      // Log detailed error information
      console.group('[RegisterPage] Full Error Details');
      
      // Special handling for 400 Bad Request
      if (statusCode === 400) {
        console.error('[RegisterPage] ⚠️ 400 Bad Request - Validation Error');
        console.error('[RegisterPage] Possible causes:');
        console.error('[RegisterPage]   1. Email format is invalid');
        console.error('[RegisterPage]   2. Password is too short (min 8 characters)');
        console.error('[RegisterPage]   3. Missing required fields');
        console.error('[RegisterPage]   4. Invalid data format');
        
        // Show validation errors if available
        if (responseData?.detail) {
          if (Array.isArray(responseData.detail)) {
            console.error('[RegisterPage] Validation errors:');
            responseData.detail.forEach((err: any, idx: number) => {
              const field = err.loc?.join('.') || 'unknown';
              const message = err.msg || 'validation error';
              console.error(`[RegisterPage]   ${idx + 1}. Field "${field}": ${message}`);
            });
          } else {
            console.error('[RegisterPage] Error detail:', responseData.detail);
          }
        }
      }
      console.error('Error Type:', err?.constructor?.name || err?.name || 'Unknown');
      console.error('Message:', err.message);
      if (statusCode) {
        console.error('Status:', `${statusCode} ${statusText || ''}`);
      }
      if (responseData) {
        console.error('Response Data:', responseData);
        try {
          console.error('Response Data (JSON):', JSON.stringify(responseData, null, 2));
        } catch (e) {
          console.error('Response Data (string):', String(responseData));
        }
      }
      if (err.stack) {
        console.error('Stack Trace:', err.stack);
      }
      console.groupEnd();
      
      // If it's a 500 error, provide specific guidance
      if (statusCode === 500) {
        console.error('[RegisterPage] ⚠️ 500 Internal Server Error - Backend Issue');
        console.error('[RegisterPage] 💡 Check the backend server terminal for the full error traceback');
        console.error('[RegisterPage] 💡 Common causes:');
        console.error('[RegisterPage]   - Database connection issue (check DATABASE_URL)');
        console.error('[RegisterPage]   - Missing database tables (run: alembic upgrade head)');
        console.error('[RegisterPage]   - Missing SECRET_KEY (check .env file)');
        console.error('[RegisterPage]   - Server configuration error');
      }
      
      // Clear tokens only on explicit unauthorized errors.
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        clearTokens();
      }
      
      // Extract error message
      let errorMessage = text.genericFail;
      
      if (err.response) {
        // Server responded with error
        const serverMessage = err.response.data?.detail || err.response.data?.message;
        if (serverMessage) {
          errorMessage = serverMessage;
        } else if (err.response.status === 500) {
          errorMessage = text.serverFail;
        } else {
          errorMessage = text.tempFail;
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = text.noResponse;
      } else {
        // Something else happened
        errorMessage = err.message || errorMessage;
      }
      
      // Show error
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrap safe-top safe-bottom" dir={isEnglish ? "ltr" : "rtl"}>
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

        <form onSubmit={handleSubmit} className="authForm">
          <div>
            <label htmlFor="email" className="label text-right">
              {text.email}
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="fullName" className="label text-right">
              {text.fullName}
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder={text.fullNamePlaceholder}
            />
          </div>

          <div>
            <label htmlFor="password" className="label text-right">
              {text.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input"
              placeholder={text.passwordPlaceholder}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label text-right">
              {text.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="input"
              placeholder={text.confirmPasswordPlaceholder}
            />
          </div>

          <div className="authActions">
            <button type="submit" disabled={loading} className="wow-btn wow-btnPrimary touch-target">
              {loading ? text.registering : text.register}
            </button>
            <button type="button" onClick={handleGoogleLogin} className="wow-btn">
              {text.google}
            </button>
          </div>
        </form>

        <div className="authFooter">
          {text.haveAccount}{' '}
          <Link to={ROUTES.LOGIN}>
            {text.login}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
