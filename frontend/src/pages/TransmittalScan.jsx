import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  getTransmittalByNumber,
  receiveTransmittalReceptionist,
  receiveTransmittalRecipient,
} from '../api';
import { useAuth } from '../context/AuthContext';
import './Scan.css';

const AUTO_LOOKUP_DELAY_MS = 500;

function purposeSummary(t) {
  const parts = [];
  if (t.purpose_return) parts.push('Return to Supplier');
  if (t.purpose_inter_warehouse) parts.push('Inter-Warehouse');
  if (t.purpose_others) parts.push('Others');
  return parts.length ? parts.join(', ') : '—';
}

export default function TransmittalScan() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [transmittal, setTransmittal] = useState(null);
  const [manualNum, setManualNum] = useState(() => location.state?.lookupNum || '');
  const [receiveLoading, setReceiveLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const autoLookupTimerRef = useRef(null);

  const fetchAndShow = useCallback(async (transmittalNumber) => {
    const num = String(transmittalNumber).trim();
    if (!num) return;
    setError('');
    setTransmittal(null);
    try {
      const data = await getTransmittalByNumber(num);
      setTransmittal(data);
    } catch (e) {
      setError(e.message || 'Transmittal not found');
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
    const fromState = location.state?.lookupNum;
    if (fromState && String(fromState).trim()) {
      fetchAndShow(fromState);
    }
  }, [location.state?.lookupNum, fetchAndShow]);

  async function startScanner() {
    setError('');
    setTransmittal(null);
    try {
      const html5Qr = new Html5Qrcode('qr-reader-transmittal');
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
    fetchAndShow(manualNum);
  }

  function handlePrintRelease() {
    if (!transmittal) return;
    navigate('/transmittal/print', { state: { transmittal, variant: 'release' } });
  }

  async function handleReceivedReceptionist() {
    if (!transmittal) return;
    setReceiveLoading(true);
    setError('');
    try {
      const updated = await receiveTransmittalReceptionist(transmittal.id, {
        received_by: user?.full_name || undefined,
      });
      setTransmittal(updated);
      navigate('/transmittal/print', { state: { transmittal: updated, variant: 'received_receptionist' } });
    } catch (e) {
      setError(e.message || 'Failed to mark received');
    } finally {
      setReceiveLoading(false);
    }
  }

  async function handleReceivedRecipient() {
    if (!transmittal) return;
    setReceiveLoading(true);
    setError('');
    try {
      const updated = await receiveTransmittalRecipient(transmittal.id, {
        received_by: user?.full_name || undefined,
      });
      setTransmittal(updated);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to mark received');
    } finally {
      setReceiveLoading(false);
    }
  }

  useEffect(() => {
    const value = manualNum.trim();
    if (value.length < 2) return;
    if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    autoLookupTimerRef.current = setTimeout(() => {
      fetchAndShow(value);
      autoLookupTimerRef.current = null;
    }, AUTO_LOOKUP_DELAY_MS);
    return () => {
      if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    };
  }, [manualNum, fetchAndShow]);

  const isOut = (transmittal?.in_or_out || 'out').toLowerCase() === 'out';
  const isIn = (transmittal?.in_or_out || 'in').toLowerCase() === 'in';
  const approved = transmittal?.status === 'approved';
  const receptionistReceived = !!transmittal?.received_by_receptionist_at;
  const recipientReceived = !!transmittal?.received_by_recipient_at;

  return (
    <div className="scan-page">
      <h1>Scan Document Transmittal</h1>
      <p className="scan-desc">
        <strong>OUT:</strong> Scan barcode after approval to print release tag. <strong>IN:</strong> Receptionist scans and clicks &quot;Received&quot; to print received tag; then recipient clicks &quot;Received&quot; when they get the items.
      </p>

      {error && <div className="scan-error">{error}</div>}

      <form className="manual-lookup" onSubmit={handleManualLookup}>
        <label>Transmittal number (scan barcode or type):</label>
        <div className="manual-row">
          <input
            type="text"
            value={manualNum}
            onChange={(e) => setManualNum(e.target.value)}
            placeholder="e.g. 20260001"
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
      <div id="qr-reader-transmittal" className="qr-reader" style={{ display: scanning ? 'block' : 'none' }} />

      {transmittal && (
        <div className="gatepass-display">
          <h2>Transmittal: {transmittal.transmittal_number}</h2>
          <div className="gp-info">
            <p><strong>In/Out:</strong> {(transmittal.in_or_out || 'out').toUpperCase()}</p>
            <p><strong>Status:</strong> <span className={`gp-status gp-status-${transmittal.status || 'pending'}`}>{transmittal.status || 'pending'}</span></p>
            <p><strong>Date:</strong> {transmittal.transmittal_date}</p>
            <p><strong>Recipient:</strong> {transmittal.recipient_name}</p>
            <p><strong>Purpose:</strong> {purposeSummary(transmittal)}</p>
            <p><strong>Vehicle Type:</strong> {transmittal.vehicle_type || '—'}</p>
            <p><strong>Plate No.:</strong> {transmittal.plate_no || '—'}</p>
            <p><strong>Truck Seal No.:</strong> {transmittal.truck_seal_no || '—'}</p>
            <p><strong>Prepared by:</strong> {transmittal.prepared_by || '—'}</p>
            <p><strong>Time Out:</strong> {transmittal.time_out || '—'} <strong>Time In:</strong> {transmittal.time_in || '—'}</p>
            {transmittal.received_by_receptionist_at && <p><strong>Received by receptionist:</strong> {transmittal.received_by_receptionist_name || '—'} at {transmittal.received_by_receptionist_at}</p>}
            {transmittal.received_by_recipient_at && <p><strong>Received by recipient:</strong> {transmittal.received_by_recipient_name || '—'} at {transmittal.received_by_recipient_at}</p>}
            {transmittal.rejected_remarks && <p><strong>Rejection remarks:</strong> {transmittal.rejected_remarks}</p>}
          </div>

          {/* OUT: print release when approved */}
          {isOut && approved && (
            <div className="gp-actions">
              <button type="button" onClick={handlePrintRelease} className="btn-primary">Print release (with approved by)</button>
            </div>
          )}
          {isOut && (transmittal.status === 'pending' || !transmittal.status) && (
            <p className="gp-scan-pending-msg">This transmittal is pending approval. Approve or reject from <strong>Transmittal — For Approval</strong>.</p>
          )}
          {isOut && transmittal.status === 'rejected' && (
            <p className="gp-scan-rejected-msg">This transmittal was rejected. It cannot be released.</p>
          )}

          {/* IN: receptionist received → print received tag; then recipient received */}
          {isIn && approved && (
            <div className="gp-actions">
              {!receptionistReceived && (
                <button type="button" onClick={handleReceivedReceptionist} className="btn-primary" disabled={receiveLoading}>
                  {receiveLoading ? 'Saving…' : 'Received (Receptionist) — Print received tag'}
                </button>
              )}
              {receptionistReceived && !recipientReceived && (
                <button type="button" onClick={handleReceivedRecipient} className="btn-primary" disabled={receiveLoading}>
                  {receiveLoading ? 'Saving…' : 'Received (Recipient)'}
                </button>
              )}
              {receptionistReceived && recipientReceived && (
                <p className="gp-scan-pending-msg">Fully received by receptionist and recipient.</p>
              )}
            </div>
          )}
          {isIn && (transmittal.status === 'pending' || !transmittal.status) && (
            <p className="gp-scan-pending-msg">This transmittal is pending approval.</p>
          )}
          {isIn && transmittal.status === 'rejected' && (
            <p className="gp-scan-rejected-msg">This transmittal was rejected.</p>
          )}

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
              {transmittal.items.map((it) => (
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
      )}
    </div>
  );
}
