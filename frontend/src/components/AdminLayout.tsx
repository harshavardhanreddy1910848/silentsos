import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp, API_BASE } from '../AppContext';
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Moon, 
  Sun,
  UserCheck
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { state, token, logout } = useApp();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('admin_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('admin_dark_mode', String(darkMode));
  }, [darkMode]);

  // Fetch active alerts periodically for notification bell
  const fetchActiveAlerts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((a: any) => a.status === 'Active');
        setActiveAlerts(active);
      }
    } catch (err) {
      console.error('Failed to fetch alerts for layout', err);
    }
  };

  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const menuItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/alerts', label: 'Emergency Alerts', icon: ShieldAlert },
    { to: '/admin/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className={`h-screen overflow-hidden flex flex-col md:flex-row ${darkMode ? 'bg-black text-textMain' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Mobile Top Bar */}
      <header className={`md:hidden flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'bg-surface border-surfaceHighlight' : 'bg-white border-slate-200'} z-30`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emergency/15 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-emergency" />
          </div>
          <span className="font-extrabold text-lg tracking-wider text-emergency">SOS ADMIN</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-surfaceHighlight text-textMuted' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop and Mobile Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 transform border-r transition-transform duration-300 md:relative md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${darkMode ? 'bg-surface border-surfaceHighlight' : 'bg-white border-slate-200'}
        flex flex-col justify-between
      `}>
        <div>
          {/* Logo Section */}
          <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-inherit">
            <div className="p-2 bg-emergency/15 rounded-xl">
              <ShieldAlert className="w-7 h-7 text-emergency" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-wider text-emergency block">SilentSOS</span>
              <span className="text-[10px] text-textMuted uppercase tracking-widest font-semibold">Admin Panel</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 py-6 space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm
                  ${isActive 
                    ? 'bg-emergency text-white shadow-lg shadow-emergency/20' 
                    : darkMode 
                      ? 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                `}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer actions inside Sidebar */}
        <div className="p-4 border-t border-inherit">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs text-textMuted font-medium">Theme Mode</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-surfaceHighlight text-warning hover:bg-surfaceHighlight/80' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200
              ${darkMode 
                ? 'border-surfaceHighlight hover:bg-emergency/10 hover:border-emergency hover:text-emergency text-textMuted' 
                : 'border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600'}
            `}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Desktop Header */}
        <header className={`hidden md:flex items-center justify-between px-8 py-4 border-b ${darkMode ? 'bg-surface border-surfaceHighlight' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-textMuted font-medium">Logged in as:</span>
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${darkMode ? 'text-textMain' : 'text-slate-900'}`}>
              <UserCheck className="w-4 h-4 text-emerald-500" />
              {state.userName || 'System Administrator'}
            </span>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Notification Bell */}
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 rounded-lg relative transition-colors ${darkMode ? 'hover:bg-surfaceHighlight text-textMuted hover:text-textMain' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
            >
              <Bell className="w-5 h-5" />
              {activeAlerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emergency rounded-full animate-pulse-fast"></span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                <div className={`
                  absolute right-0 top-12 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden
                  ${darkMode ? 'bg-surface border-surfaceHighlight' : 'bg-white border-slate-200'}
                `}>
                  <div className={`px-4 py-3 border-b font-bold text-xs uppercase tracking-wider ${darkMode ? 'border-surfaceHighlight text-textMuted' : 'border-slate-200 text-slate-500'}`}>
                    Active SOS Alerts ({activeAlerts.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {activeAlerts.length === 0 ? (
                      <div className="p-6 text-center text-sm text-textMuted">
                        No active alerts at the moment.
                      </div>
                    ) : (
                      activeAlerts.map((alert) => (
                        <div 
                          key={alert.id} 
                          onClick={() => {
                            setShowNotifications(false);
                            navigate('/admin/alerts');
                          }}
                          className={`p-4 border-b last:border-b-0 cursor-pointer transition-colors flex flex-col gap-1
                            ${darkMode ? 'border-surfaceHighlight hover:bg-surfaceHighlight/50' : 'border-slate-100 hover:bg-slate-50'}
                          `}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-emergency">{alert.type || 'General'} Alert</span>
                            <span className="text-[10px] text-textMuted">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-xs font-semibold">{alert.userName}</span>
                          <span className="text-[10px] text-textMuted truncate">{alert.userEmail}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content viewport */}
        <main className={`flex-1 p-6 md:p-8 overflow-y-auto ${darkMode ? 'bg-black' : 'bg-slate-50'}`}>
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay to dismiss mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}
    </div>
  );
}
