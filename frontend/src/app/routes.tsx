import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { ErrorBoundary } from "../components/ErrorBoundary";
import AppLayout from "../components/AppLayout";
import { HomePage } from "../pages/HomePage";
import Login from "../pages/Login";
import RegisterPage from "../pages/RegisterPage";
import { GoogleLoginRedirect } from "../pages/GoogleLoginRedirect";
import Dashboard from "../pages/Dashboard";
import { RoomsPage } from "../pages/RoomsPage";
import HousePage from "../pages/HousePage";
import AllTasksPage from "../pages/AllTasksPage";
import { AddTaskPage } from "../pages/AddTaskPage";
import ShoppingListsPage from "../pages/ShoppingListsPage";
import ShoppingListCreatePage from "../pages/ShoppingListCreatePage";
import ShoppingListDetailPage from "../pages/ShoppingListDetailPage";
import CalendarPage from "../pages/CalendarPage";
import RoomPage from "../pages/RoomPage";
import InventoryPage from "../pages/InventoryPage";
import EmotionalJournalPage from "../pages/EmotionalJournalPage";
import ContentHubPage from "../pages/ContentHubPage";
import { Settings } from "../components/Settings";
import { ROUTES } from "../utils/routes";
import { hasTokens } from "../utils/tokenStorage";
import { smokeDebug } from "../utils/smokeDebug";
import { useEffect, useState } from "react";
import { trackPageView } from "../utils/analytics";

// Track page views
const PageViewTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);
  
  return null;
};

// Catch-all route component that redirects based on auth status
const CatchAllRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for token using tokenStorage utility (single source of truth)
    try {
      const hasToken = hasTokens();
      smokeDebug("catchall:auth_check", { hasToken });
      setIsAuthenticated(hasToken);
    } catch (error) {
      console.error('[CatchAllRoute] Error checking auth:', error);
      setIsAuthenticated(false);
    }

    // Safety timeout - if still loading after 2 seconds, assume no auth
    const timeoutId = setTimeout(() => {
      setIsAuthenticated((current) => {
        if (current === null) {
          return false;
        }
        return current;
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Show loading while checking
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-cream via-cream/95 to-cream">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">⏳ טוען…</p>
        </div>
      </div>
    );
  }

  // Redirect based on auth status
  return <Navigate to={isAuthenticated ? ROUTES.HOME : ROUTES.LOGIN} replace />;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <PageViewTracker />
        <ErrorBoundary>
          <AppLayout />
        </ErrorBoundary>
      </>
    ),
    children: [
      {
        path: ROUTES.LOGIN,
        element: (
          <ErrorBoundary>
            <Login />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.REGISTER,
        element: (
          <ErrorBoundary>
            <RegisterPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.GOOGLE_CALLBACK,
        element: (
          <ErrorBoundary>
            <GoogleLoginRedirect />
          </ErrorBoundary>
        ),
      },
      {
        element: <ProtectedRoute />,
        children: [
      {
        index: true, // renders at "/" (root path) - replaces path: ROUTES.HOME to avoid duplicate "/"
        element: (
          <ErrorBoundary>
            <HomePage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.DASHBOARD,
        element: (
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.HOUSE_VIEW,
        element: (
          <ErrorBoundary>
            <HousePage />
          </ErrorBoundary>
        ),
      },
      {
        path: `${ROUTES.ROOMS}/:roomId`,
        element: (
          <ErrorBoundary>
            <RoomPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.ROOMS,
        element: (
          <ErrorBoundary>
            <RoomsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.ALL_TASKS,
        element: (
          <ErrorBoundary>
            <AllTasksPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.ADD_TASK,
        element: (
          <ErrorBoundary>
            <AddTaskPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.CALENDAR,
        element: (
          <ErrorBoundary>
            <CalendarPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.INVENTORY,
        element: (
          <ErrorBoundary>
            <InventoryPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.EMOTIONAL_JOURNAL,
        element: (
          <ErrorBoundary>
            <EmotionalJournalPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.CONTENT_HUB,
        element: (
          <ErrorBoundary>
            <ContentHubPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.SHOPPING_LISTS,
        element: (
          <ErrorBoundary>
            <ShoppingListsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.SHOPPING_LIST_CREATE,
        element: (
          <ErrorBoundary>
            <ShoppingListCreatePage />
          </ErrorBoundary>
        ),
      },
      {
        path: "/shopping/:listId",
        element: (
          <ErrorBoundary>
            <ShoppingListDetailPage />
          </ErrorBoundary>
        ),
      },
      {
        path: ROUTES.SETTINGS,
        element: (
          <ErrorBoundary>
            <Settings />
          </ErrorBoundary>
        ),
      },
        ],
      },
      {
        path: "*",
        element: <CatchAllRoute />,
      },
    ],
  },
]);
