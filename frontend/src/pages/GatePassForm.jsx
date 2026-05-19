import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProducts, getGatePass, createGatePass, updateGatePass } from '../api';
import { useAuth } from '../context/AuthContext';
import ProductPickerModal from '../components/ProductPickerModal';
import {
  MAX_LINE_ITEMS,
  parseGatePassLineItemsExcel,
  downloadGatePassLineItemsSample,
  enrichGatePassItemsFromProducts,
} from '../utils/excelLineItems';
import './Encoding.css';
import './GatePassForm.css';

const today = () => new Date().toISOString().slice(0, 10);

const emptyItem = () => ({ item_code: '', item_description: '', qty: 0, ref_doc_no: '', destination: '' });

export default function GatePassForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdGp, setCreatedGp] = useState(null);
  const [updatedGp, setUpdatedGp] = useState(null);
  const [originalNumber, setOriginalNumber] = useState('');
  const [importInfo, setImportInfo] = useState('');
  const [pickerRowIndex, setPickerRowIndex] = useState(null);
  const excelInputRef = useRef(null);
  const [form, setForm] = useState({
    pass_date: today(),
    authorized_name: '',
    in_or_out: 'in',
    purpose_delivery: true,
    purpose_return: false,
    purpose_inter_warehouse: false,
    purpose_others: false,
    vehicle_type: '',
    plate_no: '',
    attention: '',
    prepared_by: (user && user.full_name) || '',
    checked_by: '',
    recommended_by: '',
    approved_by: '',
    time_out: '',
    time_in: '',
    items: [emptyItem()],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProducts();
        if (!cancelled) setProducts(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEditMode && user && user.full_name && !form.prepared_by) {
      setForm((f) => ({ ...f, prepared_by: user.full_name }));
    }
  }, [user, isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      setError('');
      try {
        const gp = await getGatePass(editId);
        if (cancelled) return;
        setOriginalNumber(gp.gp_number || '');
        setForm({
          pass_date: (gp.pass_date || today()).toString().slice(0, 10),
          authorized_name: gp.authorized_name || '',
          in_or_out: gp.in_or_out || 'out',
          purpose_delivery: !!gp.purpose_delivery,
          purpose_return: !!gp.purpose_return,
          purpose_inter_warehouse: !!gp.purpose_inter_warehouse,
          purpose_others: !!gp.purpose_others,
          vehicle_type: gp.vehicle_type || '',
          plate_no: gp.plate_no || '',
          attention: gp.attention || '',
          prepared_by: gp.prepared_by || '',
          checked_by: gp.checked_by || '',
          recommended_by: gp.recommended_by || '',
          approved_by: gp.approved_by || '',
          time_out: gp.time_out || '',
          time_in: gp.time_in || '',
          items:
            gp.items && gp.items.length > 0
              ? gp.items.map((it) => ({
                  item_code: it.item_code || '',
                  item_description: it.item_description || '',
                  qty: it.qty ?? 0,
                  ref_doc_no: it.ref_doc_no || '',
                  destination: it.destination || '',
                }))
              : [emptyItem()],
        });
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load gate pass for editing.');
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode]);

  useEffect(() => {
    if (createdGp || updatedGp) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [createdGp, updatedGp]);

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItem(index) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  }

  function updateItem(index, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    }));
  }

  function setItemFromProduct(index, product) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === index
          ? {
              ...it,
              item_code: product.item_code || '',
              item_description: product.item_description || it.item_description || '',
            }
          : it,
      ),
    }));
  }

  function clearItemProduct(index) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === index ? { ...it, item_code: '', item_description: '' } : it,
      ),
    }));
  }

  function handleExcelImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImportInfo('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { items, error: parseErr } = parseGatePassLineItemsExcel(reader.result);
        if (parseErr) {
          setError(parseErr);
          return;
        }
        const enriched = enrichGatePassItemsFromProducts(items, products);
        if (enriched.length === 0) {
          setError('No valid rows. Each line needs an item description, or an item code that exists in Product Encoding.');
          return;
        }
        setForm((f) => ({ ...f, items: enriched }));
        setImportInfo(
          `Imported ${enriched.length} line item${enriched.length === 1 ? '' : 's'} (table replaced). Up to ${MAX_LINE_ITEMS} rows.`,
        );
      } catch (err) {
        setError(err.message || 'Could not read Excel file.');
      }
      if (excelInputRef.current) excelInputRef.current.value = '';
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      if (excelInputRef.current) excelInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  function setPurpose(which) {
    setForm((f) => ({
      ...f,
      purpose_delivery: which === 'delivery',
      purpose_return: which === 'return',
      purpose_inter_warehouse: which === 'inter_warehouse',
      purpose_others: which === 'others',
    }));
  }

  /** Item codes already selected in other rows (to avoid duplicate product in the list) */
  function usedItemCodesExcludingRow(excludeIndex) {
    const used = new Set();
    form.items.forEach((it, idx) => {
      if (idx !== excludeIndex && (it.item_code || '').trim()) used.add((it.item_code || '').trim());
    });
    return used;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setImportInfo('');
    setSubmitting(true);
    setCreatedGp(null);
    setUpdatedGp(null);
    try {
      const payload = {
        pass_date: form.pass_date,
        authorized_name: form.authorized_name.trim() || '—',
        in_or_out: form.in_or_out,
        purpose_delivery: form.purpose_delivery,
        purpose_return: form.purpose_return,
        purpose_inter_warehouse: form.purpose_inter_warehouse,
        purpose_others: form.purpose_others,
        vehicle_type: form.vehicle_type.trim() || null,
        plate_no: form.plate_no.trim() || null,
        attention: form.attention.trim() || null,
        prepared_by: form.prepared_by.trim() || null,
        checked_by: form.checked_by.trim() || null,
        recommended_by: form.recommended_by.trim() || null,
        approved_by: form.approved_by.trim() || null,
        time_out: form.time_out.trim() || null,
        time_in: form.time_in.trim() || null,
        items: form.items
          .filter((it) => (it.item_description || '').trim())
          .map((it) => ({
            item_code: (it.item_code || '').trim() || null,
            item_description: (it.item_description || '').trim(),
            qty: Math.max(0, parseInt(it.qty, 10) || 0),
            ref_doc_no: (it.ref_doc_no || '').trim() || null,
            destination: (it.destination || '').trim() || null,
          })),
      };
      if (payload.items.length === 0) {
        setError('Add at least one item with description.');
        setSubmitting(false);
        return;
      }
      if (isEditMode) {
        const result = await updateGatePass(editId, payload);
        setUpdatedGp(result);
      } else {
        const result = await createGatePass(payload);
        setCreatedGp(result);
        setForm({
          ...form,
          items: [emptyItem()],
        });
      }
    } catch (e) {
      setError(e.message || (isEditMode ? 'Failed to update gate pass' : 'Failed to create gate pass'));
    } finally {
      setSubmitting(false);
    }
  }

  function getInitialForm() {
    return {
      pass_date: today(),
      authorized_name: '',
      in_or_out: 'in',
      purpose_delivery: true,
      purpose_return: false,
      purpose_inter_warehouse: false,
      purpose_others: false,
      vehicle_type: '',
      plate_no: '',
      attention: '',
      prepared_by: (user && user.full_name) || '',
      checked_by: '',
      recommended_by: '',
      approved_by: '',
      time_out: '',
      time_in: '',
      items: [emptyItem()],
    };
  }

  function createAnother() {
    setCreatedGp(null);
    setImportInfo('');
    setForm(getInitialForm());
  }

  if (loading || loadingExisting) {
    return (
      <div className="encoding-loading">
        {loadingExisting ? 'Loading gate pass for editing…' : 'Loading…'}
      </div>
    );
  }

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>{isEditMode ? `Edit Gate Pass${originalNumber ? ` — GP#${originalNumber}` : ''}` : 'Gate Pass Form'}</h1>
      <p className="form-subtitle">
        {isEditMode
          ? 'Editing a gate pass returns it to PENDING for a fresh approval cycle.'
          : 'CHERENZ GLOBAL MFG. INC.'}
      </p>
      {error && <div className="gp-error">{error}</div>}
      {createdGp && !isEditMode && (
        <div className="gp-success-msg">
          <strong>Gate pass created:</strong> GP#{createdGp.gp_number}
          <div className="gp-success-buttons">
            <button type="button" onClick={() => navigate('/gatepass/print', { state: { gatePass: createdGp, variant: 'form' } })} className="btn-primary">Print form (with barcode)</button>
            <button type="button" onClick={createAnother} className="btn-secondary">Create another</button>
          </div>
        </div>
      )}
      {updatedGp && (
        <div className="gp-success-msg">
          <strong>Gate pass updated:</strong> GP#{updatedGp.gp_number} — status reset to <em>pending</em> for re-approval.
          <div className="gp-success-buttons">
            <button type="button" onClick={() => navigate('/gatepass/history')} className="btn-primary">
              Back to History
            </button>
            <button
              type="button"
              onClick={() => navigate('/gatepass/print', { state: { gatePass: updatedGp, variant: 'form' } })}
              className="btn-secondary"
            >
              Print form (with barcode)
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* Identification */}
        <section className="gp-section">
          <h2 className="gp-section-title">Identification</h2>
          <div className="gp-row gp-row-2">
            <label className="gp-field">
              DATE <span className="required">*</span>
              <input
                type="date"
                value={form.pass_date}
                onChange={(e) => setForm({ ...form, pass_date: e.target.value })}
                required
              />
            </label>
            <div className="gp-field-spacer" />
          </div>
          <div className="gp-row gp-row-1">
            <label className="gp-field">
              This is to authorize (Driver / Helpers / Customer) <span className="required">*</span>
              <input
                type="text"
                value={form.authorized_name}
                onChange={(e) => setForm({ ...form, authorized_name: e.target.value })}
                placeholder="Printed name"
                required
              />
            </label>
          </div>
          <div className="gp-radio-group">
            <span className="group-label">In / Out</span>
            <label>
              <input type="radio" name="in_out" checked={form.in_or_out === 'in'} onChange={() => setForm({ ...form, in_or_out: 'in' })} />
              In (items coming in)
            </label>
            <label>
              <input type="radio" name="in_out" checked={form.in_or_out === 'out'} onChange={() => setForm({ ...form, in_or_out: 'out' })} />
              Out (items going out)
            </label>
          </div>
          <div className="gp-radio-group">
            <span className="group-label">Purpose</span>
            <label>
              <input type="radio" name="purpose" checked={form.purpose_delivery} onChange={() => setPurpose('delivery')} />
              For Delivery
            </label>
            <label>
              <input type="radio" name="purpose" checked={form.purpose_return} onChange={() => setPurpose('return')} />
              Return to Supplier
            </label>
            <label>
              <input type="radio" name="purpose" checked={form.purpose_inter_warehouse} onChange={() => setPurpose('inter_warehouse')} />
              Inter-Warehouse
            </label>
            <label>
              <input type="radio" name="purpose" checked={form.purpose_others} onChange={() => setPurpose('others')} />
              Others
            </label>
          </div>
          <div className="gp-row gp-row-3 gp-row-vehicle">
            <label className="gp-field">Vehicle Type
              <input type="text" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="e.g. Truck" />
            </label>
            <label className="gp-field">Plate No.
              <input type="text" value={form.plate_no} onChange={(e) => setForm({ ...form, plate_no: e.target.value })} placeholder="Plate number" />
            </label>
            <label className="gp-field">Truck Seal No.
              <input type="text" value={form.attention} onChange={(e) => setForm({ ...form, attention: e.target.value })} placeholder="Truck Seal Number" />
            </label>
          </div>
        </section>

        {/* Item Details */}
        <section className="gp-section">
          <h2 className="gp-section-title">Item Details</h2>
          <p className="gp-excel-hint">
            Bulk lines: download the sample file, fill up to {MAX_LINE_ITEMS} rows, then import. Rows without{' '}
            <strong>Item Description</strong> are skipped; if you only enter <strong>Item Code</strong>, the description is filled from Product Encoding when the code matches.
          </p>
          {importInfo && <div className="gp-import-info">{importInfo}</div>}
          <div className="gp-item-excel-actions">
            <button type="button" className="btn-secondary" onClick={() => downloadGatePassLineItemsSample()}>
              Download sample Excel
            </button>
            <label className="btn-secondary gp-excel-upload-label">
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                style={{ display: 'none' }}
              />
              Import from Excel
            </label>
          </div>
          <div className="gp-items-table-wrap">
            <table className="gp-items-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Description</th>
                  <th>Qty</th>
                  <th>Ref. Doc/Invoice No.</th>
                  <th>Destination</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <button
                        type="button"
                        className={`gp-item-picker-btn${it.item_code ? '' : ' is-empty'}`}
                        onClick={() => setPickerRowIndex(i)}
                        title={it.item_code ? `Selected: ${it.item_code}` : 'Search and select an item'}
                      >
                        <span className="gp-item-picker-label">
                          {it.item_code || 'Select item…'}
                        </span>
                        <span className="gp-item-picker-caret" aria-hidden="true">▾</span>
                      </button>
                    </td>
                    <td>
                      <input
                        value={it.item_description}
                        onChange={(e) => updateItem(i, 'item_description', e.target.value)}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input type="number" min={0} value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} style={{ maxWidth: '100px' }} />
                    </td>
                    <td>
                      <input value={it.ref_doc_no} onChange={(e) => updateItem(i, 'ref_doc_no', e.target.value)} placeholder="Ref. No." />
                    </td>
                    <td>
                      <input value={it.destination} onChange={(e) => updateItem(i, 'destination', e.target.value)} placeholder="Destination" />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeItem(i)} className="gp-btn-remove" disabled={form.items.length === 1}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addItem} className="gp-btn-add-row">+ Add row</button>
        </section>

        {/* Signatures */}
        <section className="gp-section">
          <h2 className="gp-section-title">Signatures</h2>
          <div className="gp-row gp-row-2 gp-row-signatures">
            <label className="gp-field">Prepared by
              <input type="text" value={form.prepared_by} onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} placeholder="e.g. Administrator" />
            </label>
            <label className="gp-field">Checked by (Warehouse)
              <input type="text" value={form.checked_by} onChange={(e) => setForm({ ...form, checked_by: e.target.value })} placeholder="Name" />
            </label>
            <label className="gp-field">Recommended by
              <input type="text" value={form.recommended_by} onChange={(e) => setForm({ ...form, recommended_by: e.target.value })} placeholder="Name" />
            </label>
            <label className="gp-field">Approved by
              <input type="text" value={form.approved_by} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} placeholder="Name" />
            </label>
            <label className="gp-field">Departure - Time Out
              <input type="text" value={form.time_out} onChange={(e) => setForm({ ...form, time_out: e.target.value })} placeholder="e.g. 2040" />
            </label>
            <label className="gp-field">Arrival - Time In
              <input type="text" value={form.time_in} onChange={(e) => setForm({ ...form, time_in: e.target.value })} placeholder="Time" />
            </label>
          </div>
        </section>

        <button type="submit" className="gp-submit-btn" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : isEditMode
              ? 'Save changes (resets status to pending)'
              : 'Create Gate Pass & Generate Barcode'}
        </button>
        {isEditMode && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: '0.75rem' }}
            onClick={() => navigate('/gatepass/history')}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </form>

      <ProductPickerModal
        open={pickerRowIndex !== null}
        products={products}
        usedItemCodes={
          pickerRowIndex !== null ? Array.from(usedItemCodesExcludingRow(pickerRowIndex)) : []
        }
        selectedItemCode={
          pickerRowIndex !== null ? form.items[pickerRowIndex]?.item_code || '' : ''
        }
        onSelect={(p) => {
          if (pickerRowIndex !== null) setItemFromProduct(pickerRowIndex, p);
          setPickerRowIndex(null);
        }}
        onClear={() => {
          if (pickerRowIndex !== null) clearItemProduct(pickerRowIndex);
          setPickerRowIndex(null);
        }}
        onClose={() => setPickerRowIndex(null)}
      />
    </div>
  );
}
