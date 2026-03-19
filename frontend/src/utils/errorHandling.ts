/**
 * Centralized error handling utilities
 * Provides consistent error message extraction and formatting
 */

/**
 * Extract error message from various error formats
 */
export const extractErrorMessage = (error: any): string => {
  // Handle different error formats
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.response?.data) {
    // FastAPI error format
    if (error.response.data.detail) {
      return error.response.data.detail;
    }
    if (error.response.data.message) {
      return error.response.data.message;
    }
    if (typeof error.response.data === 'string') {
      return error.response.data;
    }
  }
  
  if (error?.message) {
    return error.message;
  }
  
  // Default fallback
  return 'שגיאה לא ידועה';
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyError = (error: any, defaultMessage: string = 'שגיאה לא ידועה'): string => {
  const message = extractErrorMessage(error);
  
  // Map common error messages to user-friendly Hebrew
  const errorMap: Record<string, string> = {
    'Network Error': 'שגיאת רשת - בדוק את החיבור לאינטרנט',
    'timeout': 'הבקשה ארכה זמן רב מדי - נסה שוב',
    '401': 'אימות נכשל - נא להתחבר מחדש',
    '403': 'אין הרשאה לבצע פעולה זו',
    '404': 'המשאב המבוקש לא נמצא',
    '500': 'שגיאת שרת - נסה שוב מאוחר יותר',
  };
  
  // Check for status code
  const status = error?.response?.status;
  if (status && errorMap[String(status)]) {
    return errorMap[String(status)];
  }
  
  // Check for common error messages
  const lowerMessage = message.toLowerCase();
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message || defaultMessage;
};
