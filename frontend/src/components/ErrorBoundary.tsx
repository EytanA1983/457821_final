import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to error reporting service (e.g., Sentry) if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-gray-900 p-4 safe-top safe-bottom">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 sm:p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <span className="emoji text-5xl block mb-4">😕</span>
              <h1 className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                שגיאה
              </h1>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                משהו השתבש. אנא נסה לרענן את הדף או לחזור לדף הקודם.
              </p>
            </div>

            {this.state.error && (
              <details className="mt-4 mb-4">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-2">
                  פרטי שגיאה (לפיתוח)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto max-h-48">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\nComponent Stack:\n'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-lg font-medium transition-colors touch-target"
              >
                🔄 נסה שוב
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors touch-target"
              >
                🔃 רענן דף
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => window.history.back()}
                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                ← חזור לדף הקודם
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
