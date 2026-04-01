import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getTransmittalByNumber, recordTransmittalOutBarcodeScan, getUsers, getDepartments } from '../api';
import { useAuth } from '../context/AuthContext';
import './Scan.css';

export default function TransmittalOutScanPage({ phase = 'receptionist' }) {
  const { user: authUser } = useAuth();
  const isReceptionist = phase === 'receptionist';
  const [manualNum, setManualNum] = useState('');
  const [transmittal, setTransmittal] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientDepartmentId, setRecipientDepartmentId] = useState('');
  const html5QrRef = useRef(null);

  useEffect(() => {
    if (!isReceptionist) return;
    let cancelled = false;
    (async () => {
      try {
        const [userData, deptData] = await Promise.all([getUsers(), getDepartments()]);
        if (!cancelled) {
          setUsers(userData || []);
          setDepartments(deptData || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Could not load departments or users. Check your role or refresh after login.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReceptionist]);

  const usersInSelectedDept = recipientDepartmentId
    ? users.filter((u) => u.department_id != null && String(u.department_id) === String(recipientDepartmentId))
    : [];

  function isApprovedOutTransmittal(t) {
    if (!t) return false;
    if ((t.in_or_out || 'out').toLowerCase() !== 'out') return false;
    return (t.status || 'pending').toLowerCase() === 'approved';
  }

  /** Recipient step: only the assigned user may record (backend enforces this too). Legacy rows with no recipient_user_id allow any user. */
  function isLoggedInAsAssignedRecipient(t) {
    if (!t || !authUser?.id) return false;
    const assigned = t.recipient_user_id;
    if (assigned == null || assigned === '') return true;
    return Number(assigned) === Number(authUser.id);
  }

  useEffect(() => {
    return () => {
      if (html5QrRef.current) html5QrRef.current.stop().catch(() => {});
    };
  }, []);

  const fetchAndShow = useCallback(async (num) => {
    const lookup = String(num || '').trim();
    if (!lookup) return;
    setError('');
    try {
      const data = await getTransmittalByNumber(lookup);
      setTransmittal(data);
      if ((data.in_or_out || 'out').toLowerCase() !== 'out') {
        setError('Only OUT transmittals are supported in this flow.');
      }
    } catch (e) {
      setTransmittal(null);
      setError(e.message || 'Transmittal not found');
    }
  }, []);

  async function submitStep(target) {
    if (!target) return;
    if (!isApprovedOutTransmittal(target)) {
      setError('Only approved OUT transmittals can be processed here.');
      return;
    }
    if (isReceptionist) {
      if (!recipientDepartmentId) {
        setError('Recipient department is required.');
        return;
      }
      if (!recipientUserId) {
        setError('Recipient user is required.');
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const next = await recordTransmittalOutBarcodeScan(target.id, {
        phase,
        recipient_department_id: isReceptionist ? Number(recipientDepartmentId) : undefined,
        recipient_user_id: isReceptionist ? Number(recipientUserId) : undefined,
      });
      setTransmittal(next);
    } catch (e) {
      setError(e.message || 'Could not record scan');
    } finally {
      setSubmitting(false);
    }
  }

  async function startScanner() {
    setError('');
    try {
      const html5Qr = new Html5Qrcode('qr-reader-transmittal-out');
      html5QrRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          try {
            await html5Qr.stop();
          } catch (_) {}
          html5QrRef.current = null;
          setScanning(false);
          await fetchAndShow(decodedText);
        },
        () => {}
      );
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
    setScanning(false);
  }

  return (
    <div className="scan-page">
      <h1>{isReceptionist ? 'Transmittal Receptionist Scan' : 'Transmittal Recipient Scan'}</h1>
      <p className="scan-desc">
        {isReceptionist
          ? 'Look up an approved OUT transmittal (barcode on the printed form or type the number), choose recipient department and user, then record receptionist receipt.'
          : 'Look up an approved OUT transmittal assigned to you, then record recipient receipt.'}
      </p>
      {isReceptionist && (
        <p className="gp-scan-hint">
          <strong>Note:</strong> Printing the gate <strong>release tag</strong> from Scan Barcode is optional. Reception can record intake as long as the transmittal is <strong>admin-approved</strong> — a release tag is not required.
        </p>
      )}

      {error && <div className="scan-error">{error}</div>}

      <form
        className="manual-lookup"
        onSubmit={(e) => {
          e.preventDefault();
          fetchAndShow(manualNum);
        }}
      >
        <label>Transmittal number:</label>
        <div className="manual-row">
          <input
            type="text"
            value={manualNum}
            onChange={(e) => setManualNum(e.target.value)}
            placeholder="e.g. 20260001"
          />
          <button type="submit" className="btn-primary">Look up</button>
        </div>
      </form>

      <div className="scan-actions">
        {!scanning ? (
          <button type="button" onClick={startScanner} className="btn-secondary btn-camera">Camera scan</button>
        ) : (
          <button type="button" onClick={stopScanner} className="btn-secondary">Stop camera</button>
        )}
      </div>
      <div id="qr-reader-transmittal-out" className="qr-reader" style={{ display: scanning ? 'block' : 'none' }} />

      {transmittal && (
        <div className="gatepass-display">
          <h2>Transmittal: {transmittal.transmittal_number}</h2>
          <div className="gp-info">
            <p><strong>Status:</strong> {transmittal.status || 'pending'}</p>
            <p><strong>In/Out:</strong> {(transmittal.in_or_out || 'out').toUpperCase()}</p>
            <p><strong>Recipient:</strong> {transmittal.recipient_name || '—'}</p>
            <p><strong>Assigned Department:</strong> {transmittal.recipient_department || '—'}</p>
            <p><strong>Assigned User:</strong> {transmittal.recipient_user_name || '—'}</p>
            <p><strong>Receptionist Received:</strong> {transmittal.received_by_receptionist_at || '—'}</p>
            <p><strong>Recipient Received:</strong> {transmittal.received_by_recipient_at || '—'}</p>
          </div>

          {isReceptionist && !isApprovedOutTransmittal(transmittal) && (
            <p className="gp-scan-pending-msg">
              {(transmittal.status || 'pending').toLowerCase() === 'rejected'
                ? 'This transmittal was rejected. It cannot be processed at reception.'
                : 'This transmittal is not approved yet. Approve it in Transmittal Approval before recording receptionist receipt.'}
            </p>
          )}

          {isReceptionist && isApprovedOutTransmittal(transmittal) && transmittal.received_by_receptionist_at && (
            <p className="gp-scan-pending-msg">
              Receptionist receipt is already recorded. The assigned recipient should use Recipient Scan to complete receipt.
            </p>
          )}

          {isReceptionist && isApprovedOutTransmittal(transmittal) && !transmittal.received_by_receptionist_at && (
            <div className="gp-actions" style={{ display: 'grid', gap: '8px', maxWidth: 560 }}>
              <label>
                Recipient Department
                <select
                  value={recipientDepartmentId}
                  onChange={(e) => {
                    setRecipientDepartmentId(e.target.value);
                    setRecipientUserId('');
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Recipient User
                <select
                  value={recipientUserId}
                  onChange={(e) => setRecipientUserId(e.target.value)}
                  disabled={!recipientDepartmentId}
                >
                  <option value="">{recipientDepartmentId ? 'Select user' : 'Choose a department first'}</option>
                  {usersInSelectedDept.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting}
                onClick={() => submitStep(transmittal)}
              >
                {submitting ? 'Saving...' : 'Record Receptionist Receipt'}
              </button>
            </div>
          )}

          {!isReceptionist && transmittal && !isApprovedOutTransmittal(transmittal) && (
            <p className="gp-scan-pending-msg">
              {(transmittal.status || 'pending').toLowerCase() === 'rejected'
                ? 'This transmittal was rejected.'
                : 'This transmittal is not approved yet. Recipient receipt is only available after admin approval and receptionist intake.'}
            </p>
          )}

          {!isReceptionist && isApprovedOutTransmittal(transmittal) && transmittal.received_by_receptionist_at && !transmittal.received_by_recipient_at && (
            !isLoggedInAsAssignedRecipient(transmittal) ? (
              <p className="gp-scan-hint">
                Only the assigned recipient
                {transmittal.recipient_user_name ? ` (${transmittal.recipient_user_name})` : ''}
                {' '}can record receipt. Log in as that user to continue.
              </p>
            ) : (
              <div className="gp-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => submitStep(transmittal)}
                >
                  {submitting ? 'Saving...' : 'Record Recipient Receipt'}
                </button>
              </div>
            )
          )}

          {!isReceptionist && isApprovedOutTransmittal(transmittal) && (!transmittal.received_by_receptionist_at || transmittal.received_by_recipient_at) && (
            <div className="gp-actions">
              {transmittal.received_by_recipient_at ? (
                <p className="gp-scan-pending-msg">This transmittal is already marked as received by the recipient.</p>
              ) : (
                <p className="gp-scan-hint">Receptionist must record receipt first before you can complete this step.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
