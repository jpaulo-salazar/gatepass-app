/**
 * Role-based access. Backend roles: scan_only, encoding, admin (gatepass_only removed, legacy treated as encoding).
 */

/** Gate Pass encoding: form, history, user/product encoding. */
const ROLE_ACCESS_ENCODING_GATEPASS = ['/gatepass', '/gatepass/history', '/users', '/products'];

/** Transmittal encoding: transmittal form and history only (no departments, scans, user encoding). */
const ROLE_ACCESS_ENCODING_TRANSMITTAL = ['/transmittal', '/transmittal/history'];

const ROLE_ACCESS = {
  scan_only: ['/gatepass/scan', '/transmittal/scan', '/transmittal/recipient'],
  /** Fallback for unknown roles; transmittal encoding is handled in isPathAllowedForRole. */
  encoding: [...ROLE_ACCESS_ENCODING_GATEPASS, ...ROLE_ACCESS_ENCODING_TRANSMITTAL],
  admin: ['/gatepass', '/gatepass/history', '/gatepass/approval', '/gatepass/scan', '/users', '/products', '/transmittal', '/transmittal/approval', '/transmittal/history', '/transmittal/scan', '/transmittal/departments', '/transmittal/receptionist', '/transmittal/recipient'],
};

/** Sections: gatepass | transmittal (no separate encoding section; User/Product are in Gate Pass top menu, User only in Transmittal). */
export const SECTION_GATEPASS = 'gatepass';
export const SECTION_TRANSMITTAL = 'transmittal';

export function isReceptionDeskUser(user) {
  return !!(user && user.system === SECTION_TRANSMITTAL && user.department_is_reception_desk);
}

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
  { path: '/transmittal/scan', label: 'Scan Barcode', section: SECTION_TRANSMITTAL, order: 4 },
  { path: '/transmittal/receptionist', label: 'Receptionist Scan', section: SECTION_TRANSMITTAL, order: 5 },
  { path: '/transmittal/recipient', label: 'Recipient Scan', section: SECTION_TRANSMITTAL, order: 6 },
  { path: '/transmittal/departments', label: 'Department Encoding', section: SECTION_TRANSMITTAL, order: 7 },
  { path: '/users', label: 'User Encoding', section: SECTION_TRANSMITTAL, order: 8 },
];

/** Path belongs to which system. /users follows current system; /products is gatepass only. */
function getPathSystem(pathname, userSystem) {
  if (pathname.startsWith('/gatepass')) return SECTION_GATEPASS;
  if (pathname.startsWith('/transmittal')) return SECTION_TRANSMITTAL;
  if (pathname.startsWith('/products')) return SECTION_GATEPASS;
  if (pathname.startsWith('/users')) return userSystem || SECTION_GATEPASS;
  return SECTION_GATEPASS;
}

function normalizePath(path) {
  return path === '/gatepass/scan' ? '/gatepass/scan' : path === '/gatepass' ? '/gatepass' : path === '/gatepass/approval' ? '/gatepass/approval' : path === '/gatepass/history' ? '/gatepass/history' : path === '/gatepass/print' ? '/gatepass/print' : path === '/users' ? '/users' : path === '/products' ? '/products' : path === '/transmittal' ? '/transmittal' : path === '/transmittal/approval' ? '/transmittal/approval' : path === '/transmittal/history' ? '/transmittal/history' : path === '/transmittal/scan' ? '/transmittal/scan' : path === '/transmittal/departments' ? '/transmittal/departments' : path === '/transmittal/receptionist' ? '/transmittal/receptionist' : path === '/transmittal/recipient' ? '/transmittal/recipient' : path === '/transmittal/print' ? '/transmittal/print' : '/gatepass';
}

/**
 * @param {object | null} user - auth user (needs department_is_reception_desk for transmittal scan_only receptionist access)
 * @param {string | null} [userSystem] - 'gatepass' | 'transmittal' (encoding role differs by system)
 */
export function isPathAllowedForRole(role, normalizedPath, user, userSystem = null) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  if (r === 'encoding') {
    const sys = userSystem || user?.system || SECTION_GATEPASS;
    if (sys === SECTION_TRANSMITTAL) {
      return ROLE_ACCESS_ENCODING_TRANSMITTAL.includes(normalizedPath);
    }
    return ROLE_ACCESS_ENCODING_GATEPASS.includes(normalizedPath);
  }
  if (normalizedPath === '/transmittal/receptionist' && r === 'scan_only') {
    return isReceptionDeskUser(user);
  }
  const allowed = ROLE_ACCESS[r] || ROLE_ACCESS.encoding;
  return allowed.includes(normalizedPath);
}

/** Product Encoding is Gate Pass only; Transmittal has no product encoding. */
export function canAccessPath(role, path, userSystem, user = null) {
  if (path === '/products' && userSystem !== SECTION_GATEPASS) return false;
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const pathSection = getPathSystem(path, userSystem);
  if (pathSection !== userSystem) return false;
  const normalized = normalizePath(path);
  return isPathAllowedForRole(r, normalized, user, userSystem) || path === '/gatepass/print' || path === '/transmittal/print';
}

/**
 * @param {object | null} user
 */
export function getDefaultPath(role, section = SECTION_GATEPASS, user = null) {
  if (role === 'scan_only') {
    if (section === SECTION_TRANSMITTAL) {
      return isReceptionDeskUser(user) ? '/transmittal/receptionist' : '/transmittal/recipient';
    }
    return '/gatepass/scan';
  }
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
export function getNavItemsForRole(role, section, userSystem, user = null) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const items = NAV_ITEMS.filter(
    (item) => item.section === section && isPathAllowedForRole(r, item.path, user, userSystem),
  );
  items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return items;
}

/** All nav items the role can access (for backward compat / redirect). */
export function getAllNavItemsForRole(role, user = null, userSystem = null) {
  const r = role === 'gatepass_only' ? 'encoding' : role;
  const sys = userSystem || user?.system || SECTION_GATEPASS;
  return NAV_ITEMS.filter((item) => isPathAllowedForRole(r, item.path, user, sys));
}
