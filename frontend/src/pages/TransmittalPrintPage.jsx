import { useLocation, useNavigate } from 'react-router-dom';
import TransmittalPrintView from '../components/TransmittalPrintView';
import './GatePassPrintPage.css';

/**
 * Print page for document transmittal: form, release, or received (receptionist) tag.
 * state: { transmittal, variant: 'form' | 'release' | 'received_receptionist' }
 */
export default function TransmittalPrintPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { transmittal, variant = 'form' } = location.state || {};

  function handlePrint() {
    window.print();
  }

  function handleClose() {
    navigate(-1);
  }

  if (!transmittal) {
    return (
      <div className="gatepass-print-page no-data">
        <p>No transmittal data to print.</p>
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
      <TransmittalPrintView transmittal={transmittal} variant={variant} />
    </div>
  );
}
