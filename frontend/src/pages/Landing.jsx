import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultPath } from '../utils/roles';
import GatePassLogo from '../components/logos/GatePassLogo';
import TransmittalLogo from '../components/logos/TransmittalLogo';
import './Landing.css';

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.system) {
      const role = user.role || 'encoding';
      navigate(getDefaultPath(role, user.system, user), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user?.system) {
    return null; // redirecting
  }

  return (
    <div className="landing-page">
      <div className="landing-card">
        <h1 className="landing-portal-title">CHERENZ GLOBAL MFG. INC.</h1>
        <p className="landing-portal-label">Portal</p>
        <p className="landing-subtitle">Select the app you want to open</p>
        <div className="landing-actions">
          <Link to="/gatepass/login" className="landing-btn landing-btn-gatepass">
            <GatePassLogo className="landing-btn-logo" size={44} />
            <span className="landing-btn-name">Gate Pass</span>
            <span className="landing-btn-desc">Gate pass forms, approval &amp; scan</span>
          </Link>
          <Link to="/transmittal/login" className="landing-btn landing-btn-transmittal">
            <TransmittalLogo className="landing-btn-logo" size={44} />
            <span className="landing-btn-name">Transmittal</span>
            <span className="landing-btn-desc">Document transmittal system</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
