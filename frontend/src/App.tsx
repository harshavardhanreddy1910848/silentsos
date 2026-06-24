import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
import { BottomNav } from './components/BottomNav';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { AlertTrigger } from './pages/AlertTrigger';
import { CameraGesture } from './pages/CameraGesture';
import { Evidence } from './pages/Evidence';
import { Contacts } from './pages/Contacts';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Receiver } from './pages/Receiver';
import { Auth } from './pages/Auth';
import { SetupPin } from './pages/SetupPin';

// Admin views
import { AdminLayout } from './components/AdminLayout';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/AdminUsers';
import { AdminAlerts } from './pages/AdminAlerts';
import { AdminSettings } from './pages/AdminSettings';

// A wrapper to handle routing logic based on setup state and auth state
function AppContent() {
  const { state, isAuthenticated, loadingToken } = useApp();
  const location = useLocation();

  if (loadingToken) {
    return (
      <div className="w-full min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
          <p className="text-white/60 text-xs font-medium tracking-wide">Initializing SilentSOS...</p>
        </div>
      </div>
    );
  }
  const isReceiver = location.pathname.startsWith('/receiver');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminLogin = location.pathname === '/admin/login';

  // Role-Based Route Guards
  if (isAdminRoute) {
    if (!isAuthenticated) {
      if (isAdminLogin) {
        return <AdminLogin />;
      }
      return <Navigate to="/admin/login" replace />;
    }

    if (state.userRole !== 'admin') {
      return <Navigate to="/" replace />;
    }

    if (isAdminLogin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  } else {
    // Route Guard: Redirect to auth if not authenticated, unless accessing a public receiver link
    if (!isAuthenticated && !isReceiver) {
      return <Auth />;
    }

    // Auto redirect authenticated Admin to admin area
    if (isAuthenticated && state.userRole === 'admin' && !isReceiver) {
      return <Navigate to="/admin/dashboard" replace />;
    }

    // Redirect to SetupPin if setup is incomplete AND safety PIN is default '1234'
    const isDefaultPin = state.settings?.safetyPin === '1234';
    if (!state.isSetupComplete && isDefaultPin && location.pathname !== '/setup-pin' && !isReceiver) {
      return <Navigate to="/setup-pin" replace />;
    }
  }

  const wrapContent = (element: React.ReactNode) => {
    if (isAdminRoute) {
      return <AdminLayout>{element}</AdminLayout>;
    }
    return (
      <div className={isReceiver ? "w-full bg-black min-h-screen text-textMain" : "mobile-container"}>
        {element}
        {!isReceiver && <BottomNav />}
      </div>
    );
  };

  return wrapContent(
    <Routes>
      {/* Admin Pages */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/alerts" element={<AdminAlerts />} />
      <Route path="/admin/settings" element={<AdminSettings />} />

      {/* User Application Pages */}
      <Route
        path="/setup-pin"
        element={state.isSetupComplete ? <Navigate to="/" /> : <SetupPin />} />

      <Route
        path="/onboarding"
        element={state.isSetupComplete ? <Navigate to="/" /> : <Onboarding />} />
      
      <Route
        path="/"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <Dashboard />

        } />
      
      <Route
        path="/alert"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <AlertTrigger />

        } />
      
      <Route
        path="/gesture"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <CameraGesture />

        } />
      
      <Route
        path="/evidence"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <Evidence />

        } />
      
      <Route
        path="/contacts"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <Contacts />

        } />
      
      <Route
        path="/history"
        element={
        !state.isSetupComplete ? <Navigate to="/onboarding" /> : <History />
        } />
      
      <Route
        path="/settings"
        element={
        !state.isSetupComplete ?
        <Navigate to="/onboarding" /> :

        <Settings />

        } />

      <Route path="/receiver/:alertId" element={<Receiver />} />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export function App() {
  return (
    <div className="w-full min-h-screen bg-black">
      <AppProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </BrowserRouter>
      </AppProvider>
    </div>
  );
}