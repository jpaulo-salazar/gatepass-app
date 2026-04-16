import { useState, useEffect, useCallback } from 'react';
import TransmittalOutScanPage from './TransmittalOutScanPage';
import { getMyUpcomingTransmittals } from '../api';
import './GatePassForm.css';
import './Scan.css';

function formatDate(d) {
  if (!d) return '—';
  const s = String(d);
  if (s.length >= 10) return `${s.slice(0, 4)} ${s.slice(5, 7)}-${s.slice(8, 10)}`;
  return s;
}

export default function TransmittalRecipient() {
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const loadUpcoming = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const data = await getMyUpcomingTransmittals();
      setUpcoming(data || []);
    } catch (e) {
      setListError(e.message || 'Could not load your list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

  return (
    <div className="encoding-page">
      <section className="gp-section" style={{ marginBottom: '1.5rem' }}>
        <h2 className="gp-section-title">Your upcoming documents</h2>
        <p className="gp-excel-hint" style={{ marginTop: 0 }}>
          Approved transmittals assigned to you. After reception records desk intake, use the scanner below to confirm
          receipt.
        </p>
        {listError && <div className="gp-error">{listError}</div>}
        {loading ? (
          <p className="encoding-loading">Loading…</p>
        ) : (
          <>
            <div className="gp-history-wrap">
              <table className="gp-history-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Desk intake</th>
                    <th>Your receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="gp-history-empty">
                        No upcoming documents assigned to you.
                      </td>
                    </tr>
                  ) : (
                    upcoming.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.transmittal_number}</strong>
                        </td>
                        <td>{formatDate(t.transmittal_date)}</td>
                        <td>{t.status || '—'}</td>
                        <td>{t.received_by_receptionist_at ? 'Received' : 'Pending'}</td>
                        <td>{t.received_by_recipient_at ? 'Done' : 'Pending'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-secondary" onClick={loadUpcoming} style={{ marginTop: '0.5rem' }}>
              Refresh list
            </button>
          </>
        )}
      </section>
      <TransmittalOutScanPage phase="recipient" />
    </div>
  );
}
