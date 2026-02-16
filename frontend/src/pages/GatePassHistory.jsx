import { useState, useEffect } from 'react';
import { getGatePasses, updateGatePassStatus } from '../api';
import './GatePassForm.css';
import './Scan.css';

export default function GatePassHistory() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewGp, setViewGp] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [showRejectRemarks, setShowRejectRemarks] = useState(false);

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

  async function handleApprove() {
    if (!viewGp) return;
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateGatePassStatus(viewGp.id, { status: 'approved' });
      setViewGp(updated);
      setList((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
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
      setViewGp(updated);
      setList((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setStatusLoading(false);
    }
  }

  const gp = viewGp;

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Gate Pass History</h1>
      <p className="form-subtitle">Movement of gate passes (in/out and status)</p>
      {error && <div className="gp-error">{error}</div>}
      <section className="gp-section">
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
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="gp-history-empty">No gate passes yet.</td>
                </tr>
              ) : (
                list.map((gp) => (
                  <tr key={gp.id}>
                    <td><strong>{gp.gp_number}</strong></td>
                    <td>{formatDate(gp.pass_date)}</td>
                    <td>{gp.authorized_name || '—'}</td>
                    <td>{(gp.in_or_out || 'out').toUpperCase()}</td>
                    <td>{purposeSummary(gp)}</td>
                    <td><span className={`gp-status gp-status-${(gp.status || 'pending').toLowerCase()}`}>{(gp.status || 'pending')}</span></td>
                    <td>{gp.rejected_remarks || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="gp-btn-view"
                        onClick={() => {
                          setViewGp(gp);
                          setShowRejectRemarks(false);
                          setRejectRemarks('');
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
              </div>
              {(gp.status === 'pending' || !gp.status) && (
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
              )}
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
