import { useState, useEffect } from 'react';
import { getGatePasses, updateGatePassStatus } from '../api';
import { useAuth } from '../context/AuthContext';
import './GatePassForm.css';
import './Scan.css';

/** Admin-only: list of gate passes pending approval. Approve/Reject here; approved/rejected appear in Gate Pass History. */
export default function ForApproval() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewGp, setViewGp] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [showRejectRemarks, setShowRejectRemarks] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getGatePasses();
        const pending = (data || []).filter((g) => (g.status || 'pending') === 'pending');
        if (!cancelled) setList(pending);
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

  if (loading) return <div className="encoding-loading">Loading gate passes for approval…</div>;

  function formatDate(d) {
    if (!d) return '—';
    const s = String(d);
    if (s.length >= 10) return `${s.slice(0, 4)} ${s.slice(5, 7)}-${s.slice(8, 10)}`;
    return d;
  }

  async function handleApprove() {
    if (!viewGp) return;
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateGatePassStatus(viewGp.id, { status: 'approved', approved_by: user?.full_name || undefined });
      setViewGp(null);
      setList((prev) => prev.filter((g) => g.id !== updated.id));
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to approve');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleReject() {
    if (!viewGp) return;
    if (!showRejectRemarks) {
      setShowRejectRemarks(true);
      return;
    }
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateGatePassStatus(viewGp.id, { status: 'rejected', rejected_remarks: rejectRemarks || null });
      setViewGp(null);
      setList((prev) => prev.filter((g) => g.id !== updated.id));
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setStatusLoading(false);
    }
  }

  const gp = viewGp;

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? list.filter((g) => {
        const gpNum = (g.gp_number || '').toLowerCase();
        const auth = (g.authorized_name || '').toLowerCase();
        const dateStr = (g.pass_date || '').toString();
        const purpose = purposeSummary(g).toLowerCase();
        const inOut = (g.in_or_out || '').toLowerCase();
        return [gpNum, auth, dateStr, purpose, inOut].some((s) => s.includes(searchLower));
      })
    : list;

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>For Approval</h1>
      <p className="form-subtitle">Gate passes pending your approval. Approve or reject here; approved and rejected passes appear in Gate Pass History.</p>
      {error && <div className="gp-error">{error}</div>}
      <section className="gp-section">
        <div className="list-search-wrap">
          <input
            type="search"
            className="list-search-input"
            placeholder="Search by GP number, authorized name, date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pending gate passes"
          />
          {search && (
            <span className="list-search-hint">{filteredList.length} of {list.length}</span>
          )}
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="gp-history-empty">
                    {list.length === 0 ? 'No gate passes pending approval.' : 'No matches for your search.'}
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
                    <td>
                      <button
                        type="button"
                        className="gp-btn-view"
                        onClick={() => {
                          setViewGp(item);
                          setShowRejectRemarks(false);
                          setRejectRemarks('');
                          setError('');
                        }}
                      >
                        View &amp; Decide
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
              </div>
              <div className="gp-actions">
                {!showRejectRemarks ? (
                  <>
                    <button type="button" onClick={handleApprove} className="btn-primary" disabled={statusLoading}>Approve</button>
                    <button type="button" onClick={handleReject} className="btn-reject" disabled={statusLoading}>Reject</button>
                  </>
                ) : (
                  <div className="reject-remarks-wrap">
                    <label>Remarks (reason for rejection):</label>
                    <textarea value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} placeholder="Enter remarks..." rows={3} />
                    <div className="reject-remarks-buttons">
                      <button type="button" onClick={handleReject} className="btn-reject" disabled={statusLoading}>Confirm Reject</button>
                      <button type="button" onClick={() => { setShowRejectRemarks(false); setRejectRemarks(''); }} className="btn-secondary">Cancel</button>
                    </div>
                  </div>
                )}
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
