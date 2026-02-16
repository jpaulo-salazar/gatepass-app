import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getGatePassByNumber, updateGatePassStatus } from '../api';
import './Scan.css';

const AUTO_LOOKUP_DELAY_MS = 500;

export default function Scan() {
  const location = useLocation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [gatePass, setGatePass] = useState(null);
  const [manualGp, setManualGp] = useState(() => location.state?.lookupGp || '');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [showRejectRemarks, setShowRejectRemarks] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const autoLookupTimerRef = useRef(null);

  const fetchAndShow = useCallback(async (gpNumber) => {
    const num = String(gpNumber).trim();
    if (!num) return;
    setError('');
    setGatePass(null);
    try {
      const data = await getGatePassByNumber(num);
      setGatePass(data);
    } catch (e) {
      setError(e.message || 'Gate pass not found');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (html5QrRef.current && scannerRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const fromHistory = location.state?.lookupGp;
    if (fromHistory && String(fromHistory).trim()) {
      fetchAndShow(fromHistory);
    }
  }, [location.state?.lookupGp, fetchAndShow]);

  async function startScanner() {
    setError('');
    setGatePass(null);
    try {
      const html5Qr = new Html5Qrcode('qr-reader');
      html5QrRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          html5Qr.stop().then(() => {
            html5QrRef.current = null;
            setScanning(false);
            fetchAndShow(decodedText);
          });
        },
        () => {}
      );
      scannerRef.current = true;
      setScanning(true);
    } catch (e) {
      setError(e.message || 'Could not start camera');
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch (_) {}
      html5QrRef.current = null;
    }
    scannerRef.current = null;
    setScanning(false);
  }

  function handleManualLookup(e) {
    e.preventDefault();
    fetchAndShow(manualGp);
  }

  async function handleApprove() {
    if (!gatePass) return;
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateGatePassStatus(gatePass.id, { status: 'approved' });
      setGatePass(updated);
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to approve');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleReject() {
    if (!gatePass) return;
    if (!showRejectRemarks) {
      setShowRejectRemarks(true);
      return;
    }
    setStatusLoading(true);
    setError('');
    try {
      const updated = await updateGatePassStatus(gatePass.id, { status: 'rejected', rejected_remarks: rejectRemarks || null });
      setGatePass(updated);
      setShowRejectRemarks(false);
      setRejectRemarks('');
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    const value = manualGp.trim();
    if (value.length < 2) return;
    if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    autoLookupTimerRef.current = setTimeout(() => {
      fetchAndShow(value);
      autoLookupTimerRef.current = null;
    }, AUTO_LOOKUP_DELAY_MS);
    return () => {
      if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    };
  }, [manualGp, fetchAndShow]);

  return (
    <div className="scan-page">
      <h1>Scan Gate Pass Barcode</h1>
      <p className="scan-desc">Focus the field below and scan the barcode—details load automatically. You can also type the GP number and press Enter or click Look up.</p>

      {error && <div className="scan-error">{error}</div>}

      <form className="manual-lookup" onSubmit={handleManualLookup}>
        <label>GP number (scan barcode or type):</label>
        <div className="manual-row">
          <input
            type="text"
            value={manualGp}
            onChange={(e) => setManualGp(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchAndShow(e.target.value); } }}
            placeholder="e.g. 63601 — focus here and scan with barcode scanner"
            autoFocus
          />
          <button type="submit" className="btn-primary">Look up</button>
        </div>
      </form>

      <div className="scan-actions">
        {!scanning ? (
          <button type="button" onClick={startScanner} className="btn-secondary btn-camera">Camera scan (QR)</button>
        ) : (
          <button type="button" onClick={stopScanner} className="btn-secondary">Stop camera</button>
        )}
      </div>
      <div id="qr-reader" className="qr-reader" style={{ display: scanning ? 'block' : 'none' }} />

      {gatePass && (
        <div className="gatepass-display">
          <h2>Gate Pass: {gatePass.gp_number}</h2>
          <div className="gp-info">
            <p><strong>In/Out:</strong> {(gatePass.in_or_out || 'out').toUpperCase()}</p>
            <p><strong>Status:</strong> <span className={`gp-status gp-status-${gatePass.status || 'pending'}`}>{gatePass.status || 'pending'}</span></p>
            <p><strong>Date:</strong> {gatePass.pass_date}</p>
            <p><strong>Authorized (Driver/Helpers/Customer):</strong> {gatePass.authorized_name}</p>
            <p><strong>Purpose:</strong>{' '}
              {[
                gatePass.purpose_delivery && 'For Delivery',
                gatePass.purpose_return && 'Return to Supplier',
                gatePass.purpose_inter_warehouse && 'Inter-Warehouse',
                gatePass.purpose_others && 'Others',
              ].filter(Boolean).join(', ') || '—'}
            </p>
            <p><strong>Vehicle Type:</strong> {gatePass.vehicle_type || '—'}</p>
            <p><strong>Plate No.:</strong> {gatePass.plate_no || '—'}</p>
            <p><strong>Prepared by:</strong> {gatePass.prepared_by || '—'}</p>
            <p><strong>Time Out:</strong> {gatePass.time_out || '—'} <strong>Time In:</strong> {gatePass.time_in || '—'}</p>
            {gatePass.rejected_remarks && <p><strong>Rejection remarks:</strong> {gatePass.rejected_remarks}</p>}
          </div>
          {(gatePass.status === 'pending' || !gatePass.status) && (
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
              {gatePass.items.map((it) => (
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
      )}
    </div>
  );
}
