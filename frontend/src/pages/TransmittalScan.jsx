import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getTransmittalByNumber, recordTransmittalReleaseScan } from '../api';
import IntransitScanSection from '../components/IntransitScanSection';
import './Scan.css';

const AUTO_LOOKUP_DELAY_MS = 500;

function purposeSummary(t) {
  const parts = [];
  if (t.purpose_return) parts.push('Return to Supplier');
  if (t.purpose_inter_warehouse) parts.push('Inter-Warehouse');
  if (t.purpose_others) parts.push('Others');
  return parts.length ? parts.join(', ') : '—';
}

/**
 * Guard / gate: scan OUT transmittal barcode after admin approval to print the release tag (same idea as Gate Pass scan).
 */
export default function TransmittalScan() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [transmittal, setTransmittal] = useState(null);
  const [intransit, setIntransit] = useState('');
  const [recording, setRecording] = useState(false);
  const [manualNum, setManualNum] = useState(() => location.state?.lookupNum || '');
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const autoLookupTimerRef = useRef(null);

  const fetchAndShow = useCallback(async (transmittalNumber) => {
    const num = String(transmittalNumber).trim();
    if (!num) return;
    setError('');
    setTransmittal(null);
    setIntransit('');
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
      const html5Qr = new Html5Qrcode('qr-reader-transmittal-release');
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

  async function recordReleaseScan() {
    if (!transmittal) return null;
    if (!intransit) {
      setError('Select an Intransit option before recording the scan.');
      return null;
    }
    setRecording(true);
    setError('');
    try {
      const updated = await recordTransmittalReleaseScan(transmittal.id, { intransit });
      setTransmittal(updated);
      return updated;
    } catch (e) {
      setError(e.message || 'Could not record scan');
      return null;
    } finally {
      setRecording(false);
    }
  }

  async function handlePrintRelease() {
    if (!transmittal) return;
    const updated = await recordReleaseScan();
    if (!updated) return;
    navigate('/transmittal/print', { state: { transmittal: updated, variant: 'release' } });
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
  const approved = transmittal?.status === 'approved';

  return (
    <div className="scan-page">
      <h1>Scan Transmittal Barcode</h1>
      <p className="scan-desc">
        After admin approval, scan the barcode (or type the transmittal number) to view the OUT transmittal and optionally print the <strong>release tag</strong> for the guard — same idea as Gate Pass scan. Internal reception does <strong>not</strong> require this print.
      </p>

      {error && <div className="scan-error">{error}</div>}

      <form className="manual-lookup" onSubmit={handleManualLookup}>
        <label>Transmittal number (scan barcode or type):</label>
        <div className="manual-row">
          <input
            type="text"
            value={manualNum}
            onChange={(e) => setManualNum(e.target.value)}
            placeholder="e.g. 20260001 — focus here and scan with barcode scanner"
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
      <div id="qr-reader-transmittal-release" className="qr-reader" style={{ display: scanning ? 'block' : 'none' }} />

      {transmittal && (
        <div className="gatepass-display">
          <h2>Transmittal: {transmittal.transmittal_number}</h2>
          <div className="gp-info">
            <p><strong>In/Out:</strong> {(transmittal.in_or_out || 'out').toUpperCase()}</p>
            <p><strong>Status:</strong> <span className={`gp-status gp-status-${transmittal.status || 'pending'}`}>{transmittal.status || 'pending'}</span></p>
            <p><strong>Date:</strong> {transmittal.transmittal_date}</p>
            <p><strong>Recipient:</strong> {transmittal.recipient_name || '—'}</p>
            <p><strong>Purpose:</strong> {purposeSummary(transmittal)}</p>
            <p><strong>Vehicle Type:</strong> {transmittal.vehicle_type || '—'}</p>
            <p><strong>Plate No.:</strong> {transmittal.plate_no || '—'}</p>
            <p><strong>Truck Seal No.:</strong> {transmittal.truck_seal_no || '—'}</p>
            <p><strong>Prepared by:</strong> {transmittal.prepared_by || '—'}</p>
            <p><strong>Time Out:</strong> {transmittal.time_out || '—'} <strong>Time In:</strong> {transmittal.time_in || '—'}</p>
            {transmittal.rejected_remarks && <p><strong>Rejection remarks:</strong> {transmittal.rejected_remarks}</p>}
          </div>

          {isOut && approved && (
            <>
              <IntransitScanSection
                intransit={intransit}
                onIntransitChange={setIntransit}
                scanEvents={transmittal.scan_events}
              />
              <div className="gp-actions">
                <button
                  type="button"
                  onClick={handlePrintRelease}
                  className="btn-primary"
                  disabled={!intransit || recording}
                >
                  {/* Print release (with approved by) */}
                  {'Release/Received'}
                </button>
              </div>
            </>
          )}
          {isOut && (transmittal.status === 'pending' || !transmittal.status) && (
            <p className="gp-scan-pending-msg">
              This transmittal is pending admin approval. Approve or reject from <strong>Transmittal — For Approval</strong>.
            </p>
          )}
          {isOut && transmittal.status === 'rejected' && (
            <p className="gp-scan-rejected-msg">This transmittal was rejected. It cannot be released.</p>
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
              {(transmittal.items || []).map((it) => (
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
