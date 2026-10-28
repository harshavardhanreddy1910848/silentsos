import { NavLink } from 'react-router-dom';
import { Home, Hand, FileText, Users, Clock, Settings } from 'lucide-react';
import { useApp } from '../AppContext';

export function BottomNav() {
  const { state } = useApp();
  if (!state.isSetupComplete || state.activeAlert?.isActive) return null;

  const navItems = [
    {
      to: '/',
      icon: Home,
      label: 'SOS Hub'
    },
    {
      to: '/gesture',
      icon: Hand,
      label: 'Gestures'
    },
    {
      to: '/evidence',
      icon: FileText,
      label: 'Evidence'
    },
    {
      to: '/contacts',
      icon: Users,
      label: 'Contacts'
    },
    {
      to: '/history',
      icon: Clock,
      label: 'History'
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#07090e]/95 backdrop-blur-xl border-t border-slate-800/80 pb-safe pt-2 px-4 z-40">
      <div className="flex justify-between items-center max-w-2xl mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-12 transition-all duration-150 ${
                isActive
                  ? 'text-[#00E676] font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[11px] tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}