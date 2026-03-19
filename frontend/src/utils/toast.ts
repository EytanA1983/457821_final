/**
 * Toast utility functions
 * Centralized toast notifications with consistent styling and behavior
 */
import toast from 'react-hot-toast';
import { TFunction } from 'i18next';

// Consistent toast options
const DEFAULT_TOAST_OPTIONS = {
  duration: 4000,
  position: 'top-center' as const,
  style: {
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    maxWidth: '400px',
  },
};

/**
 * Show success toast with consistent styling
 */
export const showSuccess = (message: string, t?: TFunction) => {
  toast.success(t ? t(message) : message, {
    ...DEFAULT_TOAST_OPTIONS,
    icon: '✅',
    style: {
      ...DEFAULT_TOAST_OPTIONS.style,
      background: '#10b981',
      color: '#fff',
    },
  });
};

/**
 * Show error toast with consistent styling
 * Accepts string, Error object, or API error response
 */
export const showError = (error: string | Error | any, t?: TFunction) => {
  // Extract error message from various formats
  let errorMessage = 'שגיאה לא ידועה';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error?.response?.data) {
    // FastAPI error format
    errorMessage = error.response.data.detail || error.response.data.message || error.message || errorMessage;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (error?.detail) {
    errorMessage = error.detail;
  }
  
  toast.error(t ? t(errorMessage) : errorMessage, {
    ...DEFAULT_TOAST_OPTIONS,
    duration: 5000, // Errors stay longer
    icon: '❌',
    style: {
      ...DEFAULT_TOAST_OPTIONS.style,
      background: '#ef4444',
      color: '#fff',
    },
  });
};

/**
 * Show info toast
 */
export const showInfo = (message: string, t?: TFunction) => {
  toast(t ? t(message) : message, {
    icon: 'ℹ️',
  });
};

/**
 * Show loading toast
 */
export const showLoading = (message: string, t?: TFunction) => {
  return toast.loading(t ? t(message) : message);
};

/**
 * Show promise toast (for async operations)
 */
export const showPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  },
  t?: TFunction
) => {
  return toast.promise(
    promise,
    {
      loading: t ? t(messages.loading) : messages.loading,
      success: t ? t(messages.success) : messages.success,
      error: t ? t(messages.error) : messages.error,
    },
    {
      success: {
        icon: '✅',
      },
      error: {
        icon: '❌',
      },
    }
  );
};

/**
 * Dismiss toast
 */
export const dismissToast = (toastId?: string) => {
  toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = () => {
  toast.dismiss();
};
