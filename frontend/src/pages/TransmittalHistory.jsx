import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getTransmittals, getTransmittal, clearTransmittalHistory } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../utils/roles';
import { formatIsoDateTimeDisplay } from '../utils/dateTime';
import './GatePassForm.css';
import './Scan.css';

function purposeSummary(t) {
  const parts = [];
  if (t.purpose_return) parts.push('Return to Supplier');
  if (t.purpose_inter_warehouse) parts.push('Inter-Warehouse');
  if (t.purpose_others) parts.push('Others');
  return parts.length ? parts.join(', ') : '—';
}

function scanEventLabel(eventType) {
  const labels = {
    drop_off_scan: 'Drop off recorded (optional)',
    receptionist_out_scan: 'Receptionist scan (received)',
    recipient_out_scan: 'Recipient scan (received)',
    receptionist_barcode_scanned: 'Receptionist scanned barcode',
    receptionist_marked_received: 'Receptionist marked received',
    recipient_barcode_scanned: 'Recipient / personnel scanned barcode',
    recipient_marked_received: 'Recipient / personnel marked received',
  };
  return labels[eventType] || eventType;
}

export default function TransmittalHistory() {
  const { user } = useAuth();
  const showClearHistoryButton = isAdminUser(user);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewT, setViewT] = useState(null);
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getTransmittals();
        if (!cancelled) setList(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="encoding-loading">Loading transmittal history…</div>;

  function formatDate(d) {
    if (!d) return '—';
    const s = String(d);
    if (s.length >= 10) return `${s.slice(0, 4)} ${s.slice(5, 7)}-${s.slice(8, 10)}`;
    return d;
  }

  const listApprovedRejected = list.filter((t) => {
    const s = (t.status || 'pending').toLowerCase();
    return s === 'approved' || s === 'rejected';
  });

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? listApprovedRejected.filter((t) => {
        const num = (t.transmittal_number || '').toLowerCase();
        const rec = (t.recipient_name || '').toLowerCase();
        const dateStr = (t.transmittal_date || '').toString();
        const statusStr = (t.status || '').toLowerCase();
        const purpose = purposeSummary(t).toLowerCase();
        const remarks = (t.rejected_remarks || '').toLowerCase();
        const inOut = (t.in_or_out || '').toLowerCase();
        return [num, rec, dateStr, statusStr, purpose, remarks, inOut].some((s) => s.includes(searchLower));
      })
    : listApprovedRejected;

  function exportToExcel() {
    const headers = [
      'Transmittal Number',
      'Date',
      'Recipient',
      'In/Out',
      'Purpose',
      'Status',
      'Vehicle Type',
      'Plate No.',
      'Prepared by',
      'Approved by',
      'Date Approved',
      'Rejected remarks',
      'Item Description',
      'Qty',
      'Ref. Doc No.',
      'Destination',
    ];
    const rows = [];
    for (const t of filteredList) {
      const itemRows = [
        t.transmittal_number || '',
        t.transmittal_date || '',
        t.recipient_name || '',
        (t.in_or_out || 'out').toUpperCase(),
        purposeSummary(t),
        t.status || 'pending',
        t.vehicle_type || '',
        t.plate_no || '',
        t.prepared_by || '',
        t.approved_by || '',
        t.date_approved || '',
        t.rejected_remarks || '',
      ];
      const items = t.items || [];
      if (items.length === 0) {
        rows.push([...itemRows, '', '', '', '']);
      } else {
        for (const it of items) {
          rows.push([
            ...itemRows,
            it.item_description || '',
            it.qty ?? '',
            it.ref_doc_no || '',
            it.destination || '',
          ]);
        }
      }
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transmittal History');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `transmittal-history-${dateStr}.xlsx`);
  }

  async function handleClearHistory() {
    if (
      !window.confirm(
        'Delete ALL transmittals (including pending)? This cannot be undone. New transmittals will keep the next number in sequence (they will not restart at 0001 for the year).',
      )
    ) {
      return;
    }
    setClearing(true);
    setError('');
    try {
      await clearTransmittalHistory();
      const data = await getTransmittals();
      setList(data);
      setViewT(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setClearing(false);
    }
  }

  const t = viewT;

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Transmittal History</h1>
      <p className="form-subtitle">Approved and rejected document transmittals. For pending items, use <strong>Transmittal — For Approval</strong>.</p>
      {error && <div className="gp-error">{error}</div>}
      <section className="gp-section">
        <div className="list-search-wrap">
          <input
            type="search"
            className="list-search-input"
            placeholder="Search by transmittal number, recipient, date, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transmittals"
          />
          {search && (
            <span className="list-search-hint">{filteredList.length} of {listApprovedRejected.length}</span>
          )}
          <button
            type="button"
            onClick={exportToExcel}
            className="btn-secondary gp-export-btn"
            disabled={filteredList.length === 0}
            title="Export current list to Excel"
          >
            Export to Excel
          </button>
          {showClearHistoryButton && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="gp-clear-history-btn"
              disabled={clearing || list.length === 0}
              title="Remove all transmittals from the database (admin)"
            >
              {clearing ? 'Clearing…' : 'Clear history'}
            </button>
          )}
        </div>
        <div className="gp-history-wrap">
          <table className="gp-history-table">
            <thead>
              <tr>
                <th>Transmittal #</th>
                <th>Date</th>
                <th>Recipient</th>
                <th>In/Out</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Rejected remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="gp-history-empty">
                    {listApprovedRejected.length === 0 ? 'No approved or rejected transmittals yet.' : 'No matches for your search.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.transmittal_number}</strong></td>
                    <td>{formatDate(item.transmittal_date)}</td>
                    <td>{item.recipient_name || '—'}</td>
                    <td>{(item.in_or_out || 'out').toUpperCase()}</td>
                    <td>{purposeSummary(item)}</td>
                    <td><span className={`gp-status gp-status-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span></td>
                    <td>{item.rejected_remarks || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="gp-btn-view"
                        onClick={async () => {
                          setError('');
                          try {
                            const full = await getTransmittal(item.id);
                            setViewT(full);
                          } catch (e) {
                            setError(e.message || 'Could not load detail');
                          }
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {t && (
        <div className="gp-modal-overlay" onClick={() => setViewT(null)}>
          <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gp-modal-header">
              <h2>Transmittal: {t.transmittal_number}</h2>
              <button type="button" className="gp-modal-close" onClick={() => setViewT(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="gatepass-display gp-modal-body">
              <div className="gp-info">
                <p><strong>In/Out:</strong> {(t.in_or_out || 'out').toUpperCase()}</p>
                <p><strong>Status:</strong> <span className={`gp-status gp-status-${(t.status || 'pending').toLowerCase()}`}>{t.status || 'pending'}</span></p>
                <p><strong>Date:</strong> {t.transmittal_date}</p>
                <p><strong>Recipient:</strong> {t.recipient_name || '—'}</p>
                <p><strong>Purpose:</strong> {purposeSummary(t)}</p>
                <p><strong>Vehicle Type:</strong> {t.vehicle_type || '—'}</p>
                <p><strong>Plate No.:</strong> {t.plate_no || '—'}</p>
                <p><strong>Truck Seal No.:</strong> {t.truck_seal_no || '—'}</p>
                <p><strong>Prepared by:</strong> {t.prepared_by || '—'}</p>
                <p><strong>Time Out:</strong> {t.time_out || '—'} <strong>Time In:</strong> {t.time_in || '—'}</p>
                {t.rejected_remarks && <p><strong>Rejection remarks:</strong> {t.rejected_remarks}</p>}
                {t.status === 'approved' && t.approved_by && <p><strong>Approved by:</strong> {t.approved_by}</p>}
                {t.status === 'approved' && t.date_approved && <p><strong>Date approved:</strong> {t.date_approved}</p>}
                {t.received_by_receptionist_at && (
                  <p>
                    <strong>Received by receptionist:</strong> {t.received_by_receptionist_name || '—'} at{' '}
                    {formatIsoDateTimeDisplay(t.received_by_receptionist_at)}
                  </p>
                )}
                {t.received_by_recipient_at && (
                  <p>
                    <strong>Received by recipient:</strong> {t.received_by_recipient_name || '—'} at{' '}
                    {formatIsoDateTimeDisplay(t.received_by_recipient_at)}
                  </p>
                )}
                {(t.scan_events || []).length > 0 && (
                  <div className="transmittal-scan-log">
                    <h3>OUT — Scan &amp; receipt log</h3>
                    <ol className="transmittal-scan-log-list">
                      {(t.scan_events || []).map((ev) => (
                        <li key={ev.id}>
                          <strong>{scanEventLabel(ev.event_type)}</strong>
                          {' — '}
                          {formatIsoDateTimeDisplay(ev.created_at)}
                          {ev.user_full_name ? ` — ${ev.user_full_name}` : ''}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <table className="gp-items-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Ref. Doc No.</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {(t.items || []).map((it) => (
                    <tr key={it.id}>
                      <td>{it.item_description}</td>
                      <td>{it.qty}</td>
                      <td>{it.ref_doc_no || '—'}</td>
                      <td>{it.destination || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
