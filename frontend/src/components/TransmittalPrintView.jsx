import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { formatIsoDateTimeDisplay } from '../utils/dateTime';
import './GatePassPrintView.css';

/**
 * Document Transmittal print: form, release tag, or received (receptionist) tag.
 * variant: 'form' | 'release' | 'received_receptionist'
 */
export default function TransmittalPrintView({ transmittal, variant = 'form' }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!transmittal?.transmittal_number || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, transmittal.transmittal_number, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        margin: 4,
      });
    } catch (e) {
      console.warn('Barcode render failed', e);
    }
  }, [transmittal?.transmittal_number]);

  if (!transmittal) return null;

  const purposeLabels = [];
  if (transmittal.purpose_return) purposeLabels.push('Return to Supplier');
  if (transmittal.purpose_inter_warehouse) purposeLabels.push('Inter-Warehouse');
  if (transmittal.purpose_others) purposeLabels.push('Others');
  const purposeText = purposeLabels.length ? purposeLabels.join(', ') : '—';

  const dateStr = transmittal.transmittal_date ? String(transmittal.transmittal_date) : '';
  const dateApprovedStr = transmittal.date_approved ? String(transmittal.date_approved) : '';

  if (variant === 'received_receptionist') {
    return (
      <div className="gatepass-print-root">
        <div className="gatepass-print-paper">
          <div className="gp-print-release-tag">
            <div className="gp-print-release-title">RECEIVED</div>
            <p><strong>Transmittal No.:</strong> {transmittal.transmittal_number}</p>
            <p><strong>Received by (Receptionist):</strong> {transmittal.received_by_receptionist_name || '—'}</p>
            <p><strong>Date/Time:</strong> {formatIsoDateTimeDisplay(transmittal.received_by_receptionist_at)}</p>
            <p><strong>Recipient:</strong> {transmittal.recipient_name || '—'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gatepass-print-root">
      <div className="gatepass-print-paper">
        <div className="gp-print-header">
          <h1 className="gp-print-company">CHERENZ GLOBAL MFG. INC.</h1>
          <h2 className="gp-print-title">DOCUMENT TRANSMITTAL</h2>
          <div className="gp-print-number-row">
            <span className="gp-print-label">Identification No.</span>
            <span className="gp-print-value gp-print-gpno">{transmittal.transmittal_number}</span>
            <span className="gp-print-label gp-print-date-label">DATE:</span>
            <span className="gp-print-value">{dateStr}</span>
          </div>
          <div className="gp-print-barcode-wrap">
            <canvas ref={barcodeRef} className="gp-print-barcode" />
          </div>
        </div>

        <div className="gp-print-section">
          <p className="gp-print-auth">Recipient: <strong>{transmittal.recipient_name || '—'}</strong></p>
          <div className="gp-print-purpose">
            <span>{transmittal.purpose_return ? '☑' : '☐'} Return to Supplier</span>
            <span>{transmittal.purpose_inter_warehouse ? '☑' : '☐'} Inter-Warehouse</span>
            <span>{transmittal.purpose_others ? '☑' : '☐'} Others</span>
          </div>
        </div>

        <div className="gp-print-section gp-print-row2">
          <span><strong>Vehicle Type:</strong> {transmittal.vehicle_type || '—'}</span>
          <span><strong>Plate No.</strong> {transmittal.plate_no || '—'}</span>
          <span><strong>Truck Seal No.:</strong> {transmittal.truck_seal_no || '—'}</span>
        </div>

        <table className="gp-print-items">
          <thead>
            <tr>
              <th>ITEM DESCRIPTION</th>
              <th>QTY.</th>
              <th>REF. DOCS/INVOICE No.</th>
              <th>DESTINATION</th>
            </tr>
          </thead>
          <tbody>
            {(transmittal.items || []).map((it) => (
              <tr key={it.id}>
                <td>{it.item_description || ''}</td>
                <td>{it.qty}</td>
                <td>{it.ref_doc_no || ''}</td>
                <td>{it.destination || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="gp-print-signatures">
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Prepared by:</span>
            <span className="gp-print-sig-line">{transmittal.prepared_by || ''}</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Checked by (GUARD):</span>
            <span className="gp-print-sig-line">{transmittal.checked_by || ''}</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Recommended by:</span>
            <span className="gp-print-sig-line">{transmittal.recommended_by || ''}</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Approved by:</span>
            <span className="gp-print-sig-line">{transmittal.approved_by || ''}</span>
          </div>
        </div>
        <div className="gp-print-dates">
          <span>Date Prepared: {dateStr}</span>
          <span>Date Approved: {dateApprovedStr || '—'}</span>
        </div>

        <div className="gp-print-departure-arrival">
          <div className="gp-print-block">
            <strong>DEPARTURE</strong>
            <p>Time Out: {transmittal.time_out || '—'}</p>
          </div>
          <div className="gp-print-block">
            <strong>ARRIVAL</strong>
            <p>Time In: {transmittal.time_in || '—'}</p>
          </div>
        </div>

        {variant === 'release' && (
          <div className="gp-print-release-tag">
            <div className="gp-print-release-title">RELEASE TAG</div>
            <p><strong>Approved by:</strong> {transmittal.approved_by || '—'}</p>
            <p><strong>Date Approved:</strong> {dateApprovedStr || '—'}</p>
            <p><strong>Transmittal No.:</strong> {transmittal.transmittal_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}
