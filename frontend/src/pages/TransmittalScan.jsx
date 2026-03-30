import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  getTransmittalByNumber,
  recordTransmittalInBarcodeScan,
} from '../api';
import './Scan.css';

const AUTO_LOOKUP_DELAY_MS = 500;

function purposeSummary(t) {
  const parts = [];
  if (t.purpose_return) parts.push('Return to Supplier');
  if (t.purpose_inter_warehouse) parts.push('Inter-Warehouse');
  if (t.purpose_others) parts.push('Others');
  return parts.length ? parts.join(', ') : '—';
}

function scanEventLabel(eventType) {
  const labels = {
    receptionist_in_scan: 'Receptionist scan (received)',
    recipient_in_scan: 'Recipient scan (received)',
    receptionist_barcode_scanned: 'Receptionist scanned barcode',
    receptionist_marked_received: 'Receptionist marked received',
    recipient_barcode_scanned: 'Recipient / personnel scanned barcode',
    recipient_marked_received: 'Recipient / personnel marked received',
  };
  return labels[eventType] || eventType;
}

export default function TransmittalScan() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [transmittal, setTransmittal] = useState(null);
  const [manualNum, setManualNum] = useState(() => location.state?.lookupNum || '');
  const [inActionLoading, setInActionLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const autoLookupTimerRef = useRef(null);

  const fetchAndShow = useCallback(async (transmittalNumber, { recordInBarcode = false } = {}) => {
    const num = String(transmittalNumber).trim();
    if (!num) return;
    setError('');
    setTransmittal(null);
    try {
      const data = await getTransmittalByNumber(num);
      let next = data;
      if (recordInBarcode) {
        const inOrOut = (data.in_or_out || 'out').toLowerCase();
        const inAllowed = inOrOut === 'in' && (data.status || '').toLowerCase() !== 'rejected';
        if (inAllowed) {
          const rRecv = !!data.received_by_receptionist_at;
          const uRecv = !!data.received_by_recipient_at;
          let phase = null;
          if (!rRecv && !uRecv) phase = 'receptionist';
          else if (rRecv && !uRecv) phase = 'recipient';
          if (phase) {
            try {
              next = await recordTransmittalInBarcodeScan(data.id, phase);
              if (
                phase === 'receptionist'
                && next.received_by_receptionist_at
                && !next.received_by_recipient_at
              ) {
                setTransmittal(next);
                navigate('/transmittal/print', {
                  state: { transmittal: next, variant: 'received_receptionist' },
                });
                return;
              }
            } catch (err) {
              setError(err.message || 'Could not record barcode scan');
              setTransmittal(data);
              return;
            }
          }
        }
      }
      setTransmittal(next);
    } catch (e) {
      setError(e.message || 'Transmittal not found');
    }
  }, [navigate]);

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
      fetchAndShow(fromState, { recordInBarcode: true });
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
            fetchAndShow(decodedText, { recordInBarcode: true });
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
    fetchAndShow(manualNum, { recordInBarcode: true });
  }

  function handlePrintRelease() {
    if (!transmittal) return;
    navigate('/transmittal/print', { state: { transmittal, variant: 'release' } });
  }

  async function recordInStep(phase) {
    if (!transmittal) return;
    setInActionLoading(true);
    setError('');
    try {
      const next = await recordTransmittalInBarcodeScan(transmittal.id, phase);
      if (
        phase === 'receptionist'
        && next.received_by_receptionist_at
        && !next.received_by_recipient_at
      ) {
        setTransmittal(next);
        navigate('/transmittal/print', {
          state: { transmittal: next, variant: 'received_receptionist' },
        });
      } else {
        setTransmittal(next);
      }
    } catch (e) {
      setError(e.message || 'Could not record receipt');
    } finally {
      setInActionLoading(false);
    }
  }

  useEffect(() => {
    const value = manualNum.trim();
    if (value.length < 2) return;
    if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    autoLookupTimerRef.current = setTimeout(() => {
      fetchAndShow(value, { recordInBarcode: false });
      autoLookupTimerRef.current = null;
    }, AUTO_LOOKUP_DELAY_MS);
    return () => {
      if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    };
  }, [manualNum, fetchAndShow]);

  const isOut = (transmittal?.in_or_out || 'out').toLowerCase() === 'out';
  const isIn = (transmittal?.in_or_out || 'in').toLowerCase() === 'in';
  const approved = transmittal?.status === 'approved';
  const inNotRejected = isIn && (transmittal?.status || '').toLowerCase() !== 'rejected';
  const receptionistReceived = !!transmittal?.received_by_receptionist_at;
  const recipientReceived = !!transmittal?.received_by_recipient_at;

  return (
    <div className="scan-page">
      <h1>Scan Document Transmittal</h1>
      <p className="scan-desc">
        <strong>OUT:</strong> Scan barcode after approval to print release tag. <strong>IN:</strong> No admin approval — receptionist confirms first, then recipient. <strong>Recording a receipt:</strong> click <strong>Look up</strong> (typing alone only previews), use <strong>Camera scan</strong>, or use the <strong>Record receptionist / recipient receipt</strong> buttons once this transmittal is on screen. You must be logged in.
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

          {inNotRejected && (transmittal.scan_events || []).length > 0 && (
            <div className="transmittal-scan-log">
              <h3>IN — Scan &amp; receipt log</h3>
              <ol className="transmittal-scan-log-list">
                {(transmittal.scan_events || []).map((ev) => (
                  <li key={ev.id}>
                    <strong>{scanEventLabel(ev.event_type)}</strong>
                    {' — '}
                    {ev.created_at}
                    {ev.user_full_name ? ` — ${ev.user_full_name}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}

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

          {/* IN: two scans only (logged); receptionist scan opens print for received tag */}
          {inNotRejected && (
            <div className="gp-actions">
              {!receptionistReceived && (
                <>
                  <p className="gp-scan-hint">Receptionist: press the button below, or scan / click <strong>Look up</strong> to record receipt (then print the reception tag if offered).</p>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={inActionLoading}
                    onClick={() => recordInStep('receptionist')}
                  >
                    {inActionLoading ? 'Saving…' : 'Record Receptionist Receipt'}
                  </button>
                </>
              )}
              {receptionistReceived && !recipientReceived && (
                <>
                  <p className="gp-scan-hint">Recipient: press the button below, or scan / <strong>Look up</strong> again to record receipt.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={inActionLoading}
                    onClick={() => recordInStep('recipient')}
                  >
                    {inActionLoading ? 'Saving…' : 'Record Recipient’s Receipt'}
                  </button>
                </>
              )}
              {receptionistReceived && recipientReceived && (
                <>
                  <p className="gp-scan-pending-msg">Fully received — receptionist and recipient steps are complete.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      navigate('/transmittal/print', {
                        state: { transmittal, variant: 'received_receptionist' },
                      })
                    }
                  >
                    Reprint Received Tag
                  </button>
                </>
              )}
            </div>
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
