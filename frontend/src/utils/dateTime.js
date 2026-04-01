/**
 * Format API ISO datetimes for display: YYYY-MM-DD HH:MM:SS (no "T").
 * Handles optional Z suffix and fractional seconds.
 */
export function formatIsoDateTimeDisplay(value) {
  if (value == null || value === '') return '—';
  let s = String(value).trim();
  if (!s) return '—';
  s = s.replace('T', ' ');
  if (s.endsWith('Z')) s = s.slice(0, -1).trim();
  s = s.replace(/\.\d+$/, '');
  return s;
}
