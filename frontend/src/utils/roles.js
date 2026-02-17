/**
 * Role-based access. Backend roles: scan_only, encoding, admin (gatepass_only removed, legacy treated as encoding).
 */

const ROLE_ACCESS = {
  scan_only: ['/scan'],
  encoding: ['/', '/history', '/users', '/products'],
  admin: ['/', '/history', '/approval', '/scan', '/users', '/products'],
};

export function canAccessPath(role, path) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const normalized = path === '/scan' ? '/scan' : path === '/users' ? '/users' : path === '/products' ? '/products' : path === '/history' ? '/history' : path === '/approval' ? '/approval' : path === '/print' ? '/print' : '/';
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  return allowed.includes(normalized) || path === '/print';
}

export function getDefaultPath(role) {
  if (role === 'scan_only') return '/scan';
  return '/';
}

/** Nav items: { path, label }. Only those the role can access. */
export function getNavItemsForRole(role) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const all = [
    { path: '/', label: 'Gate Pass Form' },
    { path: '/approval', label: 'For Approval' },
    { path: '/history', label: 'Gate Pass History' },
    { path: '/scan', label: 'Scan Barcode' },
    { path: '/users', label: 'User Encoding' },
    { path: '/products', label: 'Product Encoding' },
  ];
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  return all.filter((item) => allowed.includes(item.path));
}
