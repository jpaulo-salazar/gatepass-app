import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getNavItemsForRole,
  getDefaultPath,
  canAccessPath,
  getSectionFromPath,
  getAllowedSections,
  getRoleDisplayLabel,
  SECTION_GATEPASS,
  SECTION_TRANSMITTAL,
} from '../utils/roles';
import './Layout.css';

/** Title-case each word for header display (e.g. "receptionist" → "Receptionist"). */
function formatDisplayPersonName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'encoding';
  const userSystem = user?.system || 'gatepass';
  const allowedSections = getAllowedSections(role, userSystem);
  const section = getSectionFromPath(location.pathname, userSystem);
  const navItems = getNavItemsForRole(role, section, userSystem, user);

  useEffect(() => {
    if (!role || !userSystem) return;
    const pathAllowed = canAccessPath(role, location.pathname, userSystem, user);
    const sectionAllowed = allowedSections.includes(section);
    if (!pathAllowed || !sectionAllowed) {
      navigate(getDefaultPath(role, userSystem, user), { replace: true });
    }
  }, [role, userSystem, location.pathname, section, allowedSections, navigate, user]);

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  const sectionLabels = {
    [SECTION_GATEPASS]: 'Gate Pass',
    [SECTION_TRANSMITTAL]: 'Transmittal',
  };
  const sectionLabel = sectionLabels[section] || 'Gate Pass';

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <div className="header-brand">
            <span className="brand-name">CHERENZ GLOBAL MFG. INC.</span>
            <span className="header-section-title" aria-label="Application">
              {sectionLabel}
            </span>
          </div>
        </div>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={`${item.section}-${item.path}-${item.order ?? ''}`}
              to={item.path}
              end={item.path === '/gatepass' || item.path === '/transmittal'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-user">
          {user?.full_name && (
            <span className="header-user-name">{formatDisplayPersonName(user.full_name)}</span>
          )}
          {user?.role && (
            <span className="header-role" title="Role">{getRoleDisplayLabel(user.role)}</span>
          )}
          <button type="button" className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
