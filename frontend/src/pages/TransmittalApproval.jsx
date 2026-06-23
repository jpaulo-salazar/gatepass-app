import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTransmittals, updateTransmittalStatus } from '../api';
import { useAuth } from '../context/AuthContext';
import './GatePassForm.css';
import './Scan.css';

function canEditTransmittal(user, t) {
  if (!user || !t) return false;
  const role = String(user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'encoding') return false;
  if (t.received_by_recipient_at) return false;
  return true;
}

export default function TransmittalApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewT, setViewT] = useState(null);
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
        const data = await getTransmittals();
        const pending = (data || []).filter((t) => {
          const isPending = (t.status || 'pending') === 'pending';
          const isIn = (t.in_or_out || 'out').toLowerCase() === 'in';
          return isPending && !isIn;
        });
        if (!cancelled) setList(pending);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function purposeSummary(t) {
    const parts = [];
    if (t.purpose_return) parts.push('Return to Supplier');
    if (t.purpose_inter_warehouse) parts.push('Inter-Warehouse');
    if (t.purpose_others) parts.push('Others');
    return parts.length ? parts.join(', ') : '—';
  }

  if (loading) return <div className="encoding-loading">Loading transmittals for approval…</div>;

  function formatDate(d) {
    if (!d) return '—';
    const s = String(d);
    if (s.length >= 10) return `${s.slice(0, 4)} ${s.slice(5, 7)}-${s.slice(8, 10)}`;
    return d;
  }

  async function handleApprove() {
    if (!viewT) return;
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateTransmittalStatus(viewT.id, {
        status: 'approved',
        approved_by: user?.full_name || undefined,
      });
      setViewT(null);
      setList((prev) => prev.filter((t) => t.id !== updated.id));
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to approve');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleReject() {
    if (!viewT) return;
    if (!showRejectRemarks) {
      setShowRejectRemarks(true);
      return;
    }
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateTransmittalStatus(viewT.id, {
        status: 'rejected',
        rejected_remarks: rejectRemarks || null,
      });
      setViewT(null);
      setList((prev) => prev.filter((t) => t.id !== updated.id));
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setStatusLoading(false);
    }
  }

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? list.filter((t) => {
        const num = (t.transmittal_number || '').toLowerCase();
        const rec = (t.recipient_name || '').toLowerCase();
        const dateStr = (t.transmittal_date || '').toString();
        const purpose = purposeSummary(t).toLowerCase();
        const inOut = (t.in_or_out || '').toLowerCase();
        return [num, rec, dateStr, purpose, inOut].some((s) => s.includes(searchLower));
      })
    : list;

  const t = viewT;

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Transmittal — For Approval</h1>
      <p className="form-subtitle">OUT document transmittals pending approval. IN transmittals do not use this step.</p>
      {error && <div className="gp-error">{error}</div>}
      <section className="gp-section">
        <div className="list-search-wrap">
          <input
            type="search"
            className="list-search-input"
            placeholder="Search by transmittal number, recipient, date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pending transmittals"
          />
          {search && (
            <span className="list-search-hint">{filteredList.length} of {list.length}</span>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="gp-history-empty">
                    {list.length === 0 ? 'No OUT transmittals pending approval.' : 'No matches for your search.'}
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
                    <td>
                      <button
                        type="button"
                        className="gp-btn-view"
                        onClick={() => {
                          setViewT(item);
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
                <p><strong>Date:</strong> {t.transmittal_date}</p>
                <p><strong>Recipient:</strong> {t.recipient_name || '—'}</p>
                <p><strong>Purpose:</strong> {purposeSummary(t)}</p>
                <p><strong>Vehicle Type:</strong> {t.vehicle_type || '—'}</p>
                <p><strong>Plate No.:</strong> {t.plate_no || '—'}</p>
                <p><strong>Truck Seal No.:</strong> {t.truck_seal_no || '—'}</p>
                <p><strong>Prepared by:</strong> {t.prepared_by || '—'}</p>
                <p><strong>Time Out:</strong> {t.time_out || '—'} <strong>Time In:</strong> {t.time_in || '—'}</p>
              </div>
              <div className="gp-actions">
                {!showRejectRemarks ? (
                  <>
                    <button type="button" onClick={handleApprove} className="btn-primary" disabled={statusLoading}>Approve</button>
                    <button type="button" onClick={handleReject} className="btn-reject" disabled={statusLoading}>Reject</button>
                    {/* {canEditTransmittal(user, t) && (
                      <button
                        type="button"
                        className="gp-btn-edit gp-btn-edit-lg"
                        onClick={() => navigate(`/transmittal/edit/${t.id}`)}
                        disabled={statusLoading}
                        title="Edit transmittal (will keep status as pending)"
                      >
                        Edit
                      </button>
                    )} */}
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
