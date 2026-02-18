import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getGatePasses } from '../api';
import './GatePassForm.css';
import './Scan.css';

export default function GatePassHistory() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewGp, setViewGp] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getGatePasses();
        if (!cancelled) setList(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function purposeSummary(gp) {
    const parts = [];
    if (gp.purpose_delivery) parts.push('Delivery');
    if (gp.purpose_return) parts.push('Return');
    if (gp.purpose_inter_warehouse) parts.push('Inter-Warehouse');
    if (gp.purpose_others) parts.push('Others');
    return parts.length ? parts.join(', ') : '—';
  }

  if (loading) return <div className="encoding-loading">Loading gate pass history…</div>;

  function formatDate(d) {
    if (!d) return '—';
    const s = String(d);
    if (s.length >= 10) return `${s.slice(0, 4)} ${s.slice(5, 7)}-${s.slice(8, 10)}`;
    return d;
  }

  const gp = viewGp;

  const listApprovedRejected = list.filter((g) => {
    const s = (g.status || 'pending').toLowerCase();
    return s === 'approved' || s === 'rejected';
  });

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? listApprovedRejected.filter((g) => {
        const gpNum = (g.gp_number || '').toLowerCase();
        const auth = (g.authorized_name || '').toLowerCase();
        const dateStr = (g.pass_date || '').toString();
        const statusStr = (g.status || '').toLowerCase();
        const purpose = purposeSummary(g).toLowerCase();
        const remarks = (g.rejected_remarks || '').toLowerCase();
        const inOut = (g.in_or_out || '').toLowerCase();
        return [gpNum, auth, dateStr, statusStr, purpose, remarks, inOut].some((s) => s.includes(searchLower));
      })
    : listApprovedRejected;

  function exportToExcel() {
    const headers = [
      'GP Number',
      'Date',
      'Authorized',
      'In/Out',
      'Purpose',
      'Status',
      'Vehicle Type',
      'Plate No.',
      'Prepared by',
      'Approved by',
      'Date Approved',
      'Rejected remarks',
      'Item Code',
      'Item Description',
      'Qty',
      'Ref. Doc No.',
      'Destination',
    ];
    const rows = [];
    for (const g of filteredList) {
      const itemRows = [
        g.gp_number || '',
        g.pass_date || '',
        g.authorized_name || '',
        (g.in_or_out || 'out').toUpperCase(),
        purposeSummary(g),
        g.status || 'pending',
        g.vehicle_type || '',
        g.plate_no || '',
        g.prepared_by || '',
        g.approved_by || '',
        g.date_approved || '',
        g.rejected_remarks || '',
      ];
      const items = g.items || [];
      if (items.length === 0) {
        rows.push([...itemRows, '', '', '', '', '']);
      } else {
        for (const it of items) {
          rows.push([
            ...itemRows,
            it.item_code || '',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Gate Pass History');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `gate-pass-history-${dateStr}.xlsx`);
  }

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Gate Pass History</h1>
      <p className="form-subtitle">Approved and rejected gate passes (view only). For pending items, use <strong>For Approval</strong>.</p>
      {error && <div className="gp-error">{error}</div>}
      <section className="gp-section">
        <div className="list-search-wrap">
          <input
            type="search"
            className="list-search-input"
            placeholder="Search by GP number, authorized name, date, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search gate passes"
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
        </div>
        <div className="gp-history-wrap">
          <table className="gp-history-table">
            <thead>
              <tr>
                <th>GP Number</th>
                <th>Date</th>
                <th>Authorized</th>
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
                    {listApprovedRejected.length === 0 ? 'No approved or rejected gate passes yet.' : 'No matches for your search.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.gp_number}</strong></td>
                    <td>{formatDate(item.pass_date)}</td>
                    <td>{item.authorized_name || '—'}</td>
                    <td>{(item.in_or_out || 'out').toUpperCase()}</td>
                    <td>{purposeSummary(item)}</td>
                    <td><span className={`gp-status gp-status-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span></td>
                    <td>{item.rejected_remarks || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="gp-btn-view"
                        onClick={() => {
                          setViewGp(item);
                          setError('');
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

      {gp && (
        <div className="gp-modal-overlay" onClick={() => setViewGp(null)}>
          <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gp-modal-header">
              <h2>Gate Pass: {gp.gp_number}</h2>
              <button type="button" className="gp-modal-close" onClick={() => setViewGp(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="gatepass-display gp-modal-body">
              <div className="gp-info">
                <p><strong>In/Out:</strong> {(gp.in_or_out || 'out').toUpperCase()}</p>
                <p><strong>Status:</strong> <span className={`gp-status gp-status-${(gp.status || 'pending').toLowerCase()}`}>{gp.status || 'pending'}</span></p>
                <p><strong>Date:</strong> {gp.pass_date}</p>
                <p><strong>Authorized (Driver/Helpers/Customer):</strong> {gp.authorized_name || '—'}</p>
                <p><strong>Purpose:</strong>{' '}
                  {[
                    gp.purpose_delivery && 'For Delivery',
                    gp.purpose_return && 'Return to Supplier',
                    gp.purpose_inter_warehouse && 'Inter-Warehouse',
                    gp.purpose_others && 'Others',
                  ].filter(Boolean).join(', ') || '—'}
                </p>
                <p><strong>Vehicle Type:</strong> {gp.vehicle_type || '—'}</p>
                <p><strong>Plate No.:</strong> {gp.plate_no || '—'}</p>
                <p><strong>Prepared by:</strong> {gp.prepared_by || '—'}</p>
                <p><strong>Time Out:</strong> {gp.time_out || '—'} <strong>Time In:</strong> {gp.time_in || '—'}</p>
                {gp.rejected_remarks && <p><strong>Rejection remarks:</strong> {gp.rejected_remarks}</p>}
                {gp.status === 'approved' && gp.approved_by && <p><strong>Approved by:</strong> {gp.approved_by}</p>}
                {gp.status === 'approved' && gp.date_approved && <p><strong>Date approved:</strong> {gp.date_approved}</p>}
              </div>
              <table className="gp-items-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Ref. Doc No.</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {(gp.items || []).map((it) => (
                    <tr key={it.id}>
                      <td>{it.item_code || '—'}</td>
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
