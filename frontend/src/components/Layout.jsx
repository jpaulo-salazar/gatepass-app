import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavItemsForRole, getDefaultPath, canAccessPath } from '../utils/roles';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'encoding';
  const navItems = getNavItemsForRole(role);

  useEffect(() => {
    if (role && !canAccessPath(role, location.pathname)) {
      navigate(getDefaultPath(role), { replace: true });
    }
  }, [role, location.pathname, navigate]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-name">CHERENZ GLOBAL MFG. INC.</span>
          <span className="brand-title">Gate Pass</span>
        </div>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-user">
          {user?.full_name && <span>{user.full_name}</span>}
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
