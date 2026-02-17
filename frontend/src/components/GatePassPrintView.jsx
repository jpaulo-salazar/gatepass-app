import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import './GatePassPrintView.css';

/**
 * Paper-style gate pass form for printing (similar to CHERENZ GLOBAL MFG. INC. form).
 * variant: 'form' = initial form print (after create); 'release' = guard re-print with release tag + approved by.
 */
export default function GatePassPrintView({ gatePass, variant = 'form' }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!gatePass?.gp_number || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, gatePass.gp_number, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        margin: 4,
      });
    } catch (e) {
      console.warn('Barcode render failed', e);
    }
  }, [gatePass?.gp_number]);

  if (!gatePass) return null;

  const purposeLabels = [];
  if (gatePass.purpose_delivery) purposeLabels.push('For Delivery');
  if (gatePass.purpose_return) purposeLabels.push('Return to Supplier');
  if (gatePass.purpose_inter_warehouse) purposeLabels.push('Inter-Warehouse');
  if (gatePass.purpose_others) purposeLabels.push('Others');
  const purposeText = purposeLabels.length ? purposeLabels.join(', ') : '—';

  const passDateStr = gatePass.pass_date ? String(gatePass.pass_date) : '';
  const dateApprovedStr = gatePass.date_approved ? String(gatePass.date_approved) : '';

  return (
    <div className="gatepass-print-root">
      <div className="gatepass-print-paper">
        {/* Header */}
        <div className="gp-print-header">
          <h1 className="gp-print-company">CHERENZ GLOBAL MFG. INC.</h1>
          <h2 className="gp-print-title">GATE PASS</h2>
          <div className="gp-print-number-row">
            <span className="gp-print-label">GP CGMI NO.</span>
            <span className="gp-print-value gp-print-gpno">{gatePass.gp_number}</span>
            <span className="gp-print-label gp-print-date-label">DATE:</span>
            <span className="gp-print-value">{passDateStr}</span>
          </div>
          <div className="gp-print-barcode-wrap">
            <canvas ref={barcodeRef} className="gp-print-barcode" />
          </div>
        </div>

        {/* Authorization */}
        <div className="gp-print-section">
          <p className="gp-print-auth">This is to authorize <strong>{gatePass.authorized_name || '—'}</strong></p>
          <p className="gp-print-label-inline">PRINTED NAME OF DRIVER / HELPERS / CUSTOMER</p>
          <div className="gp-print-purpose">
            <span>{gatePass.purpose_delivery ? '☑' : '☐'} For Delivery</span>
            <span>{gatePass.purpose_return ? '☑' : '☐'} Return to Supplier</span>
            <span>{gatePass.purpose_inter_warehouse ? '☑' : '☐'} Inter-Warehouse</span>
            <span>{gatePass.purpose_others ? '☑' : '☐'} Others</span>
          </div>
        </div>

        {/* Vehicle */}
        <div className="gp-print-section gp-print-row2">
          <span><strong>Vehicle Type:</strong> {gatePass.vehicle_type || '—'}</span>
          <span><strong>Plate No.</strong> {gatePass.plate_no || '—'}</span>
          <span><strong>Attention:</strong> {gatePass.attention || '—'}</span>
        </div>

        {/* Items table */}
        <table className="gp-print-items">
          <thead>
            <tr>
              <th>ITEM CODE</th>
              <th>ITEM DESCRIPTION</th>
              <th>QTY.</th>
              <th>REF. DOCS/OR No.</th>
              <th>DESTINATION</th>
            </tr>
          </thead>
          <tbody>
            {(gatePass.items || []).map((it) => (
              <tr key={it.id}>
                <td>{it.item_code || ''}</td>
                <td>{it.item_description || ''}</td>
                <td>{it.qty}</td>
                <td>{it.ref_doc_no || ''}</td>
                <td>{it.destination || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures and dates */}
        <div className="gp-print-signatures">
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Prepared by:</span>
            <span className="gp-print-sig-line">{gatePass.prepared_by || ''}</span>
            <span className="gp-print-sig-sub">Signature Over Printed Name</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Checked by:</span>
            <span className="gp-print-sig-line">{gatePass.checked_by || ''}</span>
            <span className="gp-print-sig-sub">Signature Over Printed Name (Warehouse)</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Recommended by:</span>
            <span className="gp-print-sig-line">{gatePass.recommended_by || ''}</span>
            <span className="gp-print-sig-sub">Signature Over Printed Name</span>
          </div>
          <div className="gp-print-sig-block">
            <span className="gp-print-sig-label">Approved by:</span>
            <span className="gp-print-sig-line">{gatePass.approved_by || ''}</span>
            <span className="gp-print-sig-sub">Signature Over Printed Name</span>
          </div>
        </div>
        <div className="gp-print-dates">
          <span>Date Prepared: {passDateStr}</span>
          <span>Date Recommended: —</span>
          <span>Date Approved: {dateApprovedStr || '—'}</span>
        </div>

        {/* Departure / Arrival */}
        <div className="gp-print-departure-arrival">
          <div className="gp-print-block">
            <strong>DEPARTURE</strong>
            <p>Time Out: {gatePass.time_out || '—'}</p>
            <p className="gp-print-sig-sub">Signature Over Printed Name — Guard On Duty</p>
          </div>
          <div className="gp-print-block">
            <strong>ARRIVAL</strong>
            <p>Time In: {gatePass.time_in || '—'}</p>
            <p className="gp-print-sig-sub">Signature Over Printed Name — Guard On Duty</p>
          </div>
        </div>

        {/* Release tag (only for guard re-print after approval) */}
        {variant === 'release' && (
          <div className="gp-print-release-tag">
            <div className="gp-print-release-title">RELEASE TAG</div>
            <p><strong>Approved by:</strong> {gatePass.approved_by || '—'}</p>
            <p><strong>Date Approved:</strong> {dateApprovedStr || '—'}</p>
            <p><strong>GP Number:</strong> {gatePass.gp_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}
