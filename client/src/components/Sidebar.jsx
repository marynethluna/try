import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FileBarChart2,
  History,
  LayoutDashboard,
  MapPin,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS, can } from '../utils/permissions';
import { Logo } from './Logo';

const ICONS = {
  dashboard: LayoutDashboard,
  inventory: Boxes,
  transactions: ArrowLeftRight,
  borrowing: ClipboardList,
  categories: Tags,
  places: MapPin,
  reports: FileBarChart2,
  users: Users,
  logs: History,
};

/**
 * Navigation rail. Collapsed by default — only the orange logo mark is visible,
 * everything else fades/slides in when the rail expands. The logout and profile
 * controls live in the top bar user menu, not here.
 */
export function Sidebar({ open, pinned, isMobile, onClose, onReveal, onHide }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => can(user?.role, item.permission));
  const groups = [...new Set(items.map((item) => item.group))];

  const go = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  return (
    <>
      {isMobile && open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside
        className={[
          'sidebar',
          open ? 'is-open' : 'is-collapsed',
          pinned && !isMobile ? 'is-pinned' : '',
          isMobile ? 'is-mobile' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Main navigation"
        aria-expanded={open}
        onMouseEnter={isMobile ? undefined : onReveal}
        onMouseMove={isMobile || open ? undefined : onReveal}
        onMouseLeave={isMobile ? undefined : onHide}
        onFocus={isMobile ? undefined : onReveal}
      >
        <div className="sidebar-brand">
          <Logo height={26} tone="dark" alt="" className="brand-emblem" />
          <div className="sidebar-label sidebar-brand-text">
            <b>School Inventory System</b>
            <small>Laboratory Management</small>
          </div>
          {isMobile && open && (
            <button type="button" className="sidebar-close sidebar-label" onClick={onClose} aria-label="Close menu">
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-label sidebar-label">{group}</div>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = location.pathname === item.to;
                  return (
                    <button
                      type="button"
                      key={item.to}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => go(item.to)}
                      aria-current={active ? 'page' : undefined}
                      title={open ? undefined : item.label}
                    >
                      <span className="nav-icon">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="nav-text sidebar-label">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
