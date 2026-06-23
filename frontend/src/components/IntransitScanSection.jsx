import { INTRANSIT_OPTIONS } from '../utils/intransit';
import { formatIsoDateTimeDisplay } from '../utils/dateTime';

export default function IntransitScanSection({
  intransit,
  onIntransitChange,
  scanEvents,
  disabled = false,
}) {
  const releaseScans = (scanEvents || []).filter((e) => e.event_type === 'release_barcode_scan');

  return (
    <div className="gp-intransit-section">
      <div className="gp-intransit-row">
        <label className="gp-field gp-intransit-field">
          Intransit:
          <select
            value={intransit}
            onChange={(e) => onIntransitChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select…</option>
            {INTRANSIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>
      {releaseScans.length > 0 && (
        <div className="gp-scan-log-table-wrap">
          <table className="gp-scan-log-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Intransit</th>
                <th>Scanned By</th>
                <th>Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {releaseScans.map((ev, idx) => (
                <tr key={ev.id}>
                  <td>{idx + 1}</td>
                  <td><strong>{ev.intransit || '—'}</strong></td>
                  <td>{ev.user_full_name || '—'}</td>
                  <td>{formatIsoDateTimeDisplay(ev.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
