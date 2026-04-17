import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ErrorBoundaryTest from './components/shared/ErrorBoundaryTest';
import InitialRouteHandler from './components/App/InitialRouteHandler';
import TokenInstaller from './components/App/TokenInstaller';
import { ConditionalCopilotKit, AuthenticatedCopilotWrapper } from './components/App/CopilotWrappers';
import ClientIntelligencePageImpl from './pages/ClientIntelligencePage';
import ClientSettingsPage from './pages/ClientSettingsPage';
import GlobalSettingsPage from './pages/GlobalSettingsPage';
import { ClientAnalyticsPage } from './pages/ClientAnalyticsPage';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import ClientListPage from './pages/ClientListPage';
import ContentCalendarPage from './pages/ContentCalendarPage';
import { ArticleEditorPage } from './pages/ArticleEditorPage';
import ArticleLibraryPage from './pages/ArticleLibraryPage';
import SeoAuditPage from './pages/SeoAuditPage';
import { AppShell } from './components/shell/AppShell';
import { installClientIdGetter } from './api/client';
import { useClientStore } from './stores/clientStore';

// Install client ID getter at module load — breaks the circular import since
// App.tsx can safely import from both client.ts and clientStore.ts.
installClientIdGetter(() => useClientStore.getState().activeClientId);

// ---------------------------------------------------------------------------
// Root route: Landing (signed out) or InitialRouteHandler (signed in)
// ---------------------------------------------------------------------------
const RootRoute: React.FC = () => {
  const { isSignedIn } = useAuth();
  if (isSignedIn) {
    return <InitialRouteHandler />;
  }
  return <LoginPage />;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [copilotApiKey, setCopilotApiKey] = useState(() => {
    const savedKey = localStorage.getItem('copilotkit_api_key');
    const envKey = process.env.REACT_APP_COPILOTKIT_API_KEY || '';
    return (savedKey || envKey).trim();
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleKeyUpdate = (event: CustomEvent) => {
      const newKey = event.detail?.apiKey;
      if (newKey) {
        setCopilotApiKey(newKey);
        setTimeout(() => window.location.reload(), 500);
      }
    };
    window.addEventListener('copilotkit-key-updated', handleKeyUpdate as EventListener);
    return () => window.removeEventListener('copilotkit-key-updated', handleKeyUpdate as EventListener);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        <p className="text-sm text-muted-foreground">Connecting...</p>
      </div>
    );
  }

  const clerkPublishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || '';
  const clerkJSUrl = process.env.REACT_APP_CLERK_JS_URL;

  if (!clerkPublishableKey) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold text-destructive">Missing Clerk Publishable Key</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please add REACT_APP_CLERK_PUBLISHABLE_KEY to your .env file
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary
      context="Application Root"
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('Global error caught:', { error, errorInfo });
      }}
    >
      <ClerkProvider publishableKey={clerkPublishableKey} clerkJSUrl={clerkJSUrl}>
        <SubscriptionProvider>
          <Router>
            <AuthenticatedCopilotWrapper apiKey={copilotApiKey}>
              <ConditionalCopilotKit>
                <TokenInstaller />
                <Routes>
                  {/* Route 1: root — Landing (signed out) or redirect (signed in) */}
                  <Route path="/" element={<RootRoute />} />

                  {/* Development-only error boundary test */}
                  {process.env.NODE_ENV === 'development' && (
                    <Route path="/error-test" element={<ErrorBoundaryTest />} />
                  )}

                  {/* Route 2: /clients — client list */}
                  <Route
                    path="/clients"
                    element={
                      <ProtectedRoute>
                        <AppShell><ClientListPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 3: /clients/:clientId — client dashboard */}
                  <Route
                    path="/clients/:clientId"
                    element={
                      <ProtectedRoute>
                        <AppShell><ClientDashboardPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 4: /clients/:clientId/calendar — content calendar */}
                  <Route
                    path="/clients/:clientId/calendar"
                    element={
                      <ProtectedRoute>
                        <AppShell><ContentCalendarPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 5: /clients/:clientId/intelligence — website intelligence */}
                  <Route
                    path="/clients/:clientId/intelligence"
                    element={
                      <ProtectedRoute>
                        <AppShell><ClientIntelligencePageImpl /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 6: /clients/:clientId/settings — client settings (built in v1.1) */}
                  <Route
                    path="/clients/:clientId/settings"
                    element={
                      <ProtectedRoute>
                        <AppShell><ClientSettingsPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 7: /clients/:clientId/analytics — client analytics (built in v1.1) */}
                  <Route
                    path="/clients/:clientId/analytics"
                    element={
                      <ProtectedRoute>
                        <AppShell><ClientAnalyticsPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 8: /clients/:clientId/articles — article library */}
                  <Route
                    path="/clients/:clientId/articles"
                    element={
                      <ProtectedRoute>
                        <AppShell><ArticleLibraryPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 9: /clients/:clientId/articles/new — create new article */}
                  <Route
                    path="/clients/:clientId/articles/new"
                    element={
                      <ProtectedRoute>
                        <AppShell><ArticleEditorPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 10: /clients/:clientId/articles/:articleId — edit existing article */}
                  <Route
                    path="/clients/:clientId/articles/:articleId"
                    element={
                      <ProtectedRoute>
                        <AppShell><ArticleEditorPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 10: /settings — global settings */}
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <AppShell><GlobalSettingsPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Route 11: /clients/:clientId/seo — embedded SEO audit (open-seo) */}
                  <Route
                    path="/clients/:clientId/seo"
                    element={
                      <ProtectedRoute>
                        <AppShell><SeoAuditPage /></AppShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all: redirect unknown paths to client list */}
                  <Route path="*" element={<Navigate to="/clients" replace />} />
                </Routes>
              </ConditionalCopilotKit>
            </AuthenticatedCopilotWrapper>
          </Router>
        </SubscriptionProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
};

export default App;
