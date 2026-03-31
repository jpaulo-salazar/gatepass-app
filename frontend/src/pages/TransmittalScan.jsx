import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isReceptionDeskUser } from '../utils/roles';
import './Scan.css';

export default function TransmittalScan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const showReceptionist = (user?.role || '') !== 'scan_only' || isReceptionDeskUser(user);

  return (
    <div className="scan-page">
      <h1>Transmittal Scan</h1>
      <p className="scan-desc">
        Use the dedicated pages for the new OUT flow.
      </p>
      <div className="gp-actions">
        {showReceptionist && (
          <button type="button" className="btn-primary" onClick={() => navigate('/transmittal/receptionist')}>
            Open Receptionist Scan
          </button>
        )}
        <button type="button" className={showReceptionist ? 'btn-secondary' : 'btn-primary'} onClick={() => navigate('/transmittal/recipient')}>
          Open Recipient Scan
        </button>
      </div>
    </div>
  );
}
