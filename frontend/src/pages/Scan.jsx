import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getGatePassByNumber } from '../api';
import './Scan.css';

const AUTO_LOOKUP_DELAY_MS = 500;

export default function Scan() {
  const location = useLocation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [gatePass, setGatePass] = useState(null);
  const [manualGp, setManualGp] = useState(() => location.state?.lookupGp || '');
  const navigate = useNavigate();
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

  function handlePrintRelease() {
    if (!gatePass) return;
    navigate('/print', { state: { gatePass, variant: 'release' } });
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
      <p className="scan-desc">Guard: scan the barcode (or type GP number) to view the gate pass. If approved, you can print the release tag with approved-by details.</p>

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
          {(gatePass.status === 'approved') && (
            <div className="gp-actions">
              <button type="button" onClick={handlePrintRelease} className="btn-primary">Print release (with approved by)</button>
            </div>
          )}
          {(gatePass.status === 'pending' || !gatePass.status) && (
            <p className="gp-scan-pending-msg">This gate pass is pending admin approval. Approve or reject from <strong>Gate Pass History</strong>.</p>
          )}
          {(gatePass.status === 'rejected') && (
            <p className="gp-scan-rejected-msg">This gate pass was rejected. It cannot be released.</p>
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
