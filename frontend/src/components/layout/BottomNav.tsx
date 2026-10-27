import { NavLink } from 'react-router-dom';
import {
  ShieldIcon,
  CameraIcon,
  FolderIcon,
  UsersIcon,
  SettingsIcon } from
'lucide-react';

const items = [
{ to: '/home', label: 'Home', Icon: ShieldIcon },
{ to: '/gestures', label: 'Gestures', Icon: CameraIcon },
{ to: '/evidence', label: 'Evidence', Icon: FolderIcon },
{ to: '/contacts', label: 'Contacts', Icon: UsersIcon },
{ to: '/settings', label: 'Settings', Icon: SettingsIcon }];


export function BottomNav() {
  return (
    <nav className="grid grid-cols-5 border-t border-white/10 bg-[#0a0a0a]">
      {items.map(({ to, label, Icon }) =>
      <NavLink
        key={to}
        to={to}
        className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold">
        
          {({ isActive }) =>
        <>
              <Icon
            size={22}
            color={isActive ? '#ff1744' : '#9a9a9a'}
            strokeWidth={isActive ? 2.6 : 2} />
          
              <span style={{ color: isActive ? '#ffffff' : '#9a9a9a' }}>{label}</span>
            </>
        }
        </NavLink>
      )}
    </nav>);

}