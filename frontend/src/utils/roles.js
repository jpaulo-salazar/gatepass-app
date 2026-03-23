/**
 * Role-based access. Backend roles: scan_only, encoding, admin (gatepass_only removed, legacy treated as encoding).
 */

const ROLE_ACCESS = {
  scan_only: ['/gatepass/scan', '/transmittal/scan'],
  encoding: ['/gatepass', '/gatepass/history', '/transmittal', '/transmittal/history', '/transmittal/scan', '/users', '/products'],
  admin: ['/gatepass', '/gatepass/history', '/gatepass/approval', '/gatepass/scan', '/users', '/products', '/transmittal', '/transmittal/approval', '/transmittal/history', '/transmittal/scan'],
};

/** Sections: gatepass | transmittal (no separate encoding section; User/Product are in Gate Pass top menu, User only in Transmittal). */
export const SECTION_GATEPASS = 'gatepass';
export const SECTION_TRANSMITTAL = 'transmittal';

/** Nav items: { path, label, section }. User Encoding in both sections; Product Encoding only in Gate Pass. Order: encoding at top. */
const NAV_ITEMS = [
  { path: '/users', label: 'User Encoding', section: SECTION_GATEPASS, order: 0 },
  { path: '/products', label: 'Product Encoding', section: SECTION_GATEPASS, order: 1 },
  { path: '/gatepass', label: 'Gate Pass Form', section: SECTION_GATEPASS, order: 2 },
  { path: '/gatepass/approval', label: 'For Approval', section: SECTION_GATEPASS, order: 3 },
  { path: '/gatepass/history', label: 'Gate Pass History', section: SECTION_GATEPASS, order: 4 },
  { path: '/gatepass/scan', label: 'Scan Barcode', section: SECTION_GATEPASS, order: 5 },
  { path: '/transmittal', label: 'Transmittal Form', section: SECTION_TRANSMITTAL, order: 1 },
  { path: '/transmittal/approval', label: 'Transmittal Approval', section: SECTION_TRANSMITTAL, order: 2 },
  { path: '/transmittal/history', label: 'Transmittal History', section: SECTION_TRANSMITTAL, order: 3 },
  { path: '/transmittal/scan', label: 'Transmittal Scan', section: SECTION_TRANSMITTAL, order: 4 },
  { path: '/users', label: 'User Encoding', section: SECTION_TRANSMITTAL, order: 5 },
];

/** Path belongs to which system. /users follows current system; /products is gatepass only. */
function getPathSystem(pathname, userSystem) {
  if (pathname.startsWith('/gatepass')) return SECTION_GATEPASS;
  if (pathname.startsWith('/transmittal')) return SECTION_TRANSMITTAL;
  if (pathname.startsWith('/products')) return SECTION_GATEPASS;
  if (pathname.startsWith('/users')) return userSystem || SECTION_GATEPASS;
  return SECTION_GATEPASS;
}

/** Product Encoding is Gate Pass only; Transmittal has no product encoding. */
export function canAccessPath(role, path, userSystem) {
  if (path === '/products' && userSystem !== SECTION_GATEPASS) return false;
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const pathSection = getPathSystem(path, userSystem);
  if (pathSection !== userSystem) return false;
  const normalized = path === '/gatepass/scan' ? '/gatepass/scan' : path === '/gatepass' ? '/gatepass' : path === '/gatepass/approval' ? '/gatepass/approval' : path === '/gatepass/history' ? '/gatepass/history' : path === '/gatepass/print' ? '/gatepass/print' : path === '/users' ? '/users' : path === '/products' ? '/products' : path === '/transmittal' ? '/transmittal' : path === '/transmittal/approval' ? '/transmittal/approval' : path === '/transmittal/history' ? '/transmittal/history' : path === '/transmittal/scan' ? '/transmittal/scan' : path === '/transmittal/print' ? '/transmittal/print' : '/gatepass';
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  return allowed.includes(normalized) || path === '/gatepass/print' || path === '/transmittal/print';
}

export function getDefaultPath(role, section = SECTION_GATEPASS) {
  if (role === 'scan_only') return section === SECTION_TRANSMITTAL ? '/transmittal/scan' : '/gatepass/scan';
  if (section === SECTION_TRANSMITTAL) return '/transmittal';
  return '/gatepass';
}

/** Get current section from pathname. userSystem needed for /users (stays in current section). */
export function getSectionFromPath(pathname, userSystem) {
  if (pathname.startsWith('/gatepass')) return SECTION_GATEPASS;
  if (pathname.startsWith('/transmittal')) return SECTION_TRANSMITTAL;
  if (pathname.startsWith('/products')) return SECTION_GATEPASS;
  if (pathname.startsWith('/users')) return userSystem || SECTION_GATEPASS;
  return SECTION_GATEPASS;
}

/** Only Gate Pass and Transmittal sections (no separate User & Product section). */
export function getAllowedSections(role, userSystem) {
  return [userSystem];
}

/** Nav items for role and section. Encoding (User, Product) at top for Gate Pass; User Encoding at end for Transmittal. */
export function getNavItemsForRole(role, section, userSystem) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  const items = NAV_ITEMS.filter(
    (item) => item.section === section && allowed.includes(item.path)
  );
  items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return items;
}

/** All nav items the role can access (for backward compat / redirect). */
export function getAllNavItemsForRole(role) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  return NAV_ITEMS.filter((item) => allowed.includes(item.path));
}
