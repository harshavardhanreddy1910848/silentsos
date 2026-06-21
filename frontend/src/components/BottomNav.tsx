import { NavLink } from 'react-router-dom';
import { Home, Camera, Folder, Users, Settings, History } from 'lucide-react';
import { useApp } from '../AppContext';
export function BottomNav() {
  const { state } = useApp();
  if (!state.isSetupComplete || state.activeAlert?.isActive) return null;
  const navItems = [
  {
    to: '/',
    icon: Home,
    label: 'SOS'
  },
  {
    to: '/gesture',
    icon: Camera,
    label: 'Gesture'
  },
  {
    to: '/evidence',
    icon: Folder,
    label: 'Evidence'
  },
  {
    to: '/contacts',
    icon: Users,
    label: 'Contacts'
  },
  {
    to: '/history',
    icon: History,
    label: 'History'
  },
  {
    to: '/settings',
    icon: Settings,
    label: 'Settings'
  }];

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-surfaceHighlight pb-safe pt-2 px-2 z-40">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) =>
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
          `flex flex-col items-center justify-center w-full h-14 rounded-xl transition-colors ${isActive ? 'text-emergency' : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight'}`
          }>
          
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        )}
      </div>
    </nav>);

}