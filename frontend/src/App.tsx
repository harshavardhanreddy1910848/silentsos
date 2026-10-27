import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation } from
'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/layout/BottomNav';
import { LiveAlertProvider } from './hooks/useLiveAlert';
import { AlertTrigger } from './pages/AlertTrigger';
import { Auth } from './pages/Auth';
import { Contacts } from './pages/Contacts';
import { EvidenceDetail } from './pages/EvidenceDetail';
import { Evidence } from './pages/Evidence';
import { GestureDetection } from './pages/GestureDetection';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Support } from './pages/Support';
import { Welcome } from './pages/Welcome';
import { ForgotPassword } from './pages/ForgotPassword';

const TABS = ['/home', '/gestures', '/evidence', '/contacts', '/settings'];
const ENTRY_ROUTES = ['/', '/auth', '/forgot-password', '/reset-password'];

function Shell() {
  const { profile } = useApp();
  const location = useLocation();
  const { pathname } = location;

  if (!profile.authenticated && !ENTRY_ROUTES.includes(pathname)) {
    return <Navigate to="/" replace />;
  }

  if (profile.authenticated && !profile.onboarded && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (profile.authenticated && profile.onboarded && ENTRY_ROUTES.includes(pathname)) {
    // If navigating explicitly with a token, allow token authentication / password reset to proceed
    if (pathname === '/reset-password' || pathname === '/forgot-password' || location.search.includes('token=')) {
      // allow through to reset or re-auth with token
    } else {
      return <Navigate to="/home" replace />;
    }
  }

  const showNav = TABS.includes(pathname);

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#0a0a0a]">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a]">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ForgotPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<Home />} />
            <Route path="/alert" element={<AlertTrigger />} />
            <Route path="/gestures" element={<GestureDetection />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/evidence/:id" element={<EvidenceDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {showNav && <BottomNav />}
      </div>
    </div>);
}

export function App() {
  return (
    <AppProvider>
      <LiveAlertProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </LiveAlertProvider>
    </AppProvider>);

}