import { useLocation, useNavigate } from 'react-router-dom';
import GatePassPrintView from '../components/GatePassPrintView';
import './GatePassPrintPage.css';

/**
 * Dedicated page for printing a gate pass form or release.
 * Receives gatePass and variant via location.state (from GatePassForm or Scan).
 */
export default function GatePassPrintPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { gatePass, variant = 'form' } = location.state || {};

  function handlePrint() {
    window.print();
  }

  function handleClose() {
    navigate(-1);
  }

  if (!gatePass) {
    return (
      <div className="gatepass-print-page no-data">
        <p>No gate pass data to print.</p>
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Go back</button>
      </div>
    );
  }

  return (
    <div className="gatepass-print-page">
      <div className="gatepass-print-actions no-print">
        <button type="button" onClick={handlePrint} className="btn-primary">Print</button>
        <button type="button" onClick={handleClose} className="btn-secondary">Close</button>
      </div>
      <GatePassPrintView gatePass={gatePass} variant={variant} />
    </div>
  );
}
