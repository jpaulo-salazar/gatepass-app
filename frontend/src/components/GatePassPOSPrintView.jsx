import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import './GatePassPOSPrintView.css';

/**
 * POS/receipt-style print view for gate pass release (e.g. 58mm/80mm thermal).
 * Compact, narrow width, line-by-line text. Use from Scan page "Print release (POS)".
 */
export default function GatePassPOSPrintView({ gatePass }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!gatePass?.gp_number || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, gatePass.gp_number, {
        format: 'CODE128',
        width: 1.2,
        height: 28,
        displayValue: true,
        margin: 2,
        font: 'monospace',
        fontSize: 10,
      });
    } catch (e) {
      console.warn('POS barcode render failed', e);
    }
  }, [gatePass?.gp_number]);

  if (!gatePass) return null;

  const purposeLabels = [];
  if (gatePass.purpose_delivery) purposeLabels.push('Delivery');
  if (gatePass.purpose_return) purposeLabels.push('Return');
  if (gatePass.purpose_inter_warehouse) purposeLabels.push('Inter-Whse');
  if (gatePass.purpose_others) purposeLabels.push('Others');
  const purposeText = purposeLabels.length ? purposeLabels.join(', ') : '—';
  const dateApprovedStr = gatePass.date_approved ? String(gatePass.date_approved) : '—';
  const passDateStr = gatePass.pass_date ? String(gatePass.pass_date) : '—';

  return (
    <div className="gp-pos-root">
      <div className="gp-pos-paper">
        <div className="gp-pos-line gp-pos-center gp-pos-bold">CHERENZ GLOBAL MFG. INC.</div>
        <div className="gp-pos-line gp-pos-center gp-pos-bold">GATE PASS — RELEASE</div>
        <div className="gp-pos-divider">--------------------------------</div>

        <div className="gp-pos-line"><span className="gp-pos-label">GP No:</span> {gatePass.gp_number}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Date:</span> {passDateStr}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Approved by:</span> {gatePass.approved_by || '—'}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Date approved:</span> {dateApprovedStr}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Authorized:</span> {gatePass.authorized_name || '—'}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Purpose:</span> {purposeText}</div>
        <div className="gp-pos-line"><span className="gp-pos-label">Vehicle:</span> {gatePass.vehicle_type || '—'} {gatePass.plate_no ? `| ${gatePass.plate_no}` : ''}</div>

        <div className="gp-pos-divider">--------------------------------</div>
        <div className="gp-pos-line gp-pos-bold">ITEMS</div>

        {(gatePass.items || []).map((it) => (
          <div key={it.id} className="gp-pos-item">
            <span className="gp-pos-item-code">{String(it.item_code || '').slice(0, 12)}</span>
            <span className="gp-pos-item-qty">x{it.qty}</span>
            <div className="gp-pos-item-desc">{it.item_description || ''}</div>
          </div>
        ))}

        <div className="gp-pos-divider">--------------------------------</div>
        <div className="gp-pos-barcode-wrap">
          <canvas ref={barcodeRef} className="gp-pos-barcode" />
        </div>
        <div className="gp-pos-line gp-pos-center gp-pos-small">GP#{gatePass.gp_number}</div>
        <div className="gp-pos-line gp-pos-center gp-pos-small">Thank you</div>
      </div>
    </div>
  );
}
