import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createTransmittal,
  getTransmittal,
  getTransmittalEmployeeRecipients,
  updateTransmittal,
} from '../api';
import { useAuth } from '../context/AuthContext';
import {
  MAX_LINE_ITEMS,
  parseTransmittalLineItemsExcel,
  downloadTransmittalLineItemsSample,
} from '../utils/excelLineItems';
import './Encoding.css';
import './GatePassForm.css';

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = () => ({ item_description: '', qty: 0, ref_doc_no: '', destination: '' });

export default function TransmittalForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTransmittal, setCreatedTransmittal] = useState(null);
  const [updatedTransmittal, setUpdatedTransmittal] = useState(null);
  const [importInfo, setImportInfo] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [originalNumber, setOriginalNumber] = useState('');
  const [editWarning, setEditWarning] = useState('');
  const excelInputRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [form, setForm] = useState({
    transmittal_date: today(),
    recipient_user_id: '',
    purpose_return: false,
    purpose_inter_warehouse: false,
    purpose_others: false,
    vehicle_type: '',
    plate_no: '',
    truck_seal_no: '',
    prepared_by: (user && user.full_name) || '',
    checked_by: '',
    recommended_by: '',
    approved_by: '',
    time_out: '',
    time_in: '',
    items: [emptyItem()],
  });

  useEffect(() => {
    if (!isEditMode && user?.full_name && !form.prepared_by) {
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
        const t = await getTransmittal(editId);
        if (cancelled) return;
        if (t.received_by_recipient_at) {
          setError('This transmittal cannot be edited: the recipient has already received it.');
        } else if (t.received_by_receptionist_at) {
          setEditWarning(
            'Heads up: the receptionist has already received the previous version. Saving will reset their intake so they can re-confirm the new approved version.',
          );
        }
        setOriginalNumber(t.transmittal_number || '');
        setForm({
          transmittal_date: (t.transmittal_date || today()).toString().slice(0, 10),
          recipient_user_id: t.recipient_user_id ? String(t.recipient_user_id) : '',
          purpose_return: !!t.purpose_return,
          purpose_inter_warehouse: !!t.purpose_inter_warehouse,
          purpose_others: !!t.purpose_others,
          vehicle_type: t.vehicle_type || '',
          plate_no: t.plate_no || '',
          truck_seal_no: t.truck_seal_no || '',
          prepared_by: t.prepared_by || '',
          checked_by: t.checked_by || '',
          recommended_by: t.recommended_by || '',
          approved_by: t.approved_by || '',
          time_out: t.time_out || '',
          time_in: t.time_in || '',
          items:
            (t.items && t.items.length > 0
              ? t.items.map((it) => ({
                  item_description: it.item_description || '',
                  qty: it.qty ?? 0,
                  ref_doc_no: it.ref_doc_no || '',
                  destination: it.destination || '',
                }))
              : [emptyItem()]),
        });
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load transmittal for editing.');
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEmployees(true);
      try {
        const data = await getTransmittalEmployeeRecipients();
        if (!cancelled) setEmployees(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load recipient employees.');
      } finally {
        if (!cancelled) setLoadingEmployees(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (createdTransmittal || updatedTransmittal) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [createdTransmittal, updatedTransmittal]);

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

  function handleExcelImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImportInfo('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { items, error: parseErr } = parseTransmittalLineItemsExcel(reader.result);
        if (parseErr) {
          setError(parseErr);
          return;
        }
        setForm((f) => ({ ...f, items }));
        setImportInfo(
          `Imported ${items.length} line item${items.length === 1 ? '' : 's'} (table replaced). Up to ${MAX_LINE_ITEMS} rows.`,
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
      purpose_return: which === 'return',
      purpose_inter_warehouse: which === 'inter_warehouse',
      purpose_others: which === 'others',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setImportInfo('');
    setCreatedTransmittal(null);
    setUpdatedTransmittal(null);
    if (!form.recipient_user_id) {
      setError('Select a recipient employee (User Encoding → role Employee).');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        transmittal_date: form.transmittal_date,
        recipient_user_id: Number(form.recipient_user_id),
        purpose_return: form.purpose_return,
        purpose_inter_warehouse: form.purpose_inter_warehouse,
        purpose_others: form.purpose_others,
        vehicle_type: form.vehicle_type.trim() || null,
        plate_no: form.plate_no.trim() || null,
        truck_seal_no: form.truck_seal_no.trim() || null,
        prepared_by: form.prepared_by.trim() || null,
        checked_by: form.checked_by.trim() || null,
        recommended_by: form.recommended_by.trim() || null,
        approved_by: form.approved_by.trim() || null,
        time_out: form.time_out.trim() || null,
        time_in: form.time_in.trim() || null,
        items: form.items
          .filter((it) => (it.item_description || '').trim())
          .map((it) => ({
            item_description: (it.item_description || '').trim(),
            qty: Math.max(0, parseInt(it.qty, 10) || 0),
            ref_doc_no: (it.ref_doc_no || '').trim() || null,
            destination: (it.destination || '').trim() || null,
          })),
      };
      if (payload.items.length === 0) {
        setError('Add at least one item with description.');
        return;
      }
      if (isEditMode) {
        const result = await updateTransmittal(editId, payload);
        setUpdatedTransmittal(result);
      } else {
        const createPayload = { ...payload, in_or_out: 'out' };
        const result = await createTransmittal(createPayload);
        setCreatedTransmittal(result);
        setForm({ ...form, items: [emptyItem()] });
      }
    } catch (e) {
      setError(
        e.message ||
          (isEditMode ? 'Failed to update document transmittal' : 'Failed to create document transmittal'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function createAnother() {
    setCreatedTransmittal(null);
    setImportInfo('');
    setForm({
      ...form,
      transmittal_date: today(),
      recipient_user_id: '',
      items: [emptyItem()],
    });
  }

  if (loadingExisting) {
    return <div className="encoding-loading">Loading transmittal for editing…</div>;
  }

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>{isEditMode ? `Edit Transmittal${originalNumber ? ` — #${originalNumber}` : ''}` : 'Document Transmittal Form'}</h1>
      <p className="form-subtitle">
        {isEditMode
          ? 'Editing a transmittal returns it to PENDING for a fresh admin approval cycle.'
          : 'CHERENZ GLOBAL MFG. INC. — DOCUMENT TRANSMITTAL SYSTEM'}
      </p>
      {error && <div className="gp-error">{error}</div>}
      {isEditMode && editWarning && !error && (
        <div className="gp-import-info" role="status">
          {editWarning}
        </div>
      )}
      {createdTransmittal && (
        <div className="gp-success-msg">
          <strong>Transmittal created:</strong> #{createdTransmittal.transmittal_number}
          <div className="gp-success-buttons">
            <button
              type="button"
              onClick={() =>
                navigate('/transmittal/print', {
                  state: { transmittal: createdTransmittal, variant: 'form' },
                })
              }
              className="btn-primary"
            >
              Print form (with barcode)
            </button>
            <button type="button" onClick={createAnother} className="btn-secondary">
              Create another
            </button>
          </div>
        </div>
      )}
      {updatedTransmittal && (
        <div className="gp-success-msg">
          <strong>Transmittal updated:</strong> #{updatedTransmittal.transmittal_number} — status reset to <em>pending</em> for re-approval.
          <div className="gp-success-buttons">
            <button
              type="button"
              onClick={() => navigate('/transmittal/history')}
              className="btn-primary"
            >
              Back to History
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/transmittal/print', {
                  state: { transmittal: updatedTransmittal, variant: 'form' },
                })
              }
              className="btn-secondary"
            >
              Print form (with barcode)
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <section className="gp-section">
          <h2 className="gp-section-title">Identification</h2>
          <div className="gp-row gp-row-2">
            <label className="gp-field">
              DATE <span className="required">*</span>
              <input
                type="date"
                value={form.transmittal_date}
                onChange={(e) => setForm({ ...form, transmittal_date: e.target.value })}
                required
              />
            </label>
            <label className="gp-field">
              Recipient (employee) <span className="required">*</span>
              <select
                value={form.recipient_user_id}
                onChange={(e) => setForm({ ...form, recipient_user_id: e.target.value })}
                required
                disabled={loadingEmployees}
              >
                <option value="">{loadingEmployees ? 'Loading employees…' : '— Select employee —'}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {(emp.full_name || emp.username || '').trim() || `User #${emp.id}`}
                    {emp.department ? ` — ${emp.department}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="scan-desc"><strong>Flow:</strong> Document transmittal is OUT only.</p>
          <div className="gp-radio-group">
            <span className="group-label">Purpose</span>
            <label>
              <input
                type="radio"
                name="purpose"
                checked={form.purpose_return}
                onChange={() => setPurpose('return')}
              />
              Return to supplier
            </label>
            <label>
              <input
                type="radio"
                name="purpose"
                checked={form.purpose_inter_warehouse}
                onChange={() => setPurpose('inter_warehouse')}
              />
              Inter-warehouse
            </label>
            <label>
              <input
                type="radio"
                name="purpose"
                checked={form.purpose_others}
                onChange={() => setPurpose('others')}
              />
              Others
            </label>
          </div>
          <div className="gp-row gp-row-3 gp-row-vehicle">
            <label className="gp-field">
              Vehicle Type
              <input
                type="text"
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                placeholder="e.g. Truck"
              />
            </label>
            <label className="gp-field">
              Plate No.
              <input
                type="text"
                value={form.plate_no}
                onChange={(e) => setForm({ ...form, plate_no: e.target.value })}
                placeholder="Plate number"
              />
            </label>
            <label className="gp-field">
              Truck Seal No.
              <input
                type="text"
                value={form.truck_seal_no}
                onChange={(e) => setForm({ ...form, truck_seal_no: e.target.value })}
                placeholder="Truck Seal Number"
              />
            </label>
          </div>
        </section>

        <section className="gp-section">
          <h2 className="gp-section-title">Item Details</h2>
          <p className="gp-excel-hint">
            Bulk lines: download the sample file, fill up to {MAX_LINE_ITEMS} document lines, then import. First row must be
            headers; each data row needs <strong>Item Description</strong> (other columns optional).
          </p>
          {importInfo && <div className="gp-import-info">{importInfo}</div>}
          <div className="gp-item-excel-actions">
            <button type="button" className="btn-secondary" onClick={() => downloadTransmittalLineItemsSample()}>
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
                      <input
                        value={it.item_description}
                        onChange={(e) => updateItem(i, 'item_description', e.target.value)}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={it.qty}
                        onChange={(e) => updateItem(i, 'qty', e.target.value)}
                        style={{ maxWidth: '100px' }}
                      />
                    </td>
                    <td>
                      <input
                        value={it.ref_doc_no}
                        onChange={(e) => updateItem(i, 'ref_doc_no', e.target.value)}
                        placeholder="Ref. No."
                      />
                    </td>
                    <td>
                      <input
                        value={it.destination}
                        onChange={(e) => updateItem(i, 'destination', e.target.value)}
                        placeholder="Destination"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="gp-btn-remove"
                        disabled={form.items.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addItem} className="gp-btn-add-row">
            + Add row
          </button>
        </section>

        <section className="gp-section">
          <h2 className="gp-section-title">Signatures</h2>
          <div className="gp-row gp-row-2 gp-row-signatures">
            <label className="gp-field">
              Prepared by
              <input
                type="text"
                value={form.prepared_by}
                onChange={(e) => setForm({ ...form, prepared_by: e.target.value })}
                placeholder="e.g. Sender"
              />
            </label>
            <label className="gp-field">
              Checked by (GUARD)
              <input
                type="text"
                value={form.checked_by}
                onChange={(e) => setForm({ ...form, checked_by: e.target.value })}
                placeholder="Name"
              />
            </label>
            <label className="gp-field">
              Approved by
              <input
                type="text"
                value={form.approved_by}
                onChange={(e) => setForm({ ...form, approved_by: e.target.value })}
                placeholder="Name"
              />
            </label>
            <label className="gp-field">
              Recommended by
              <input
                type="text"
                value={form.recommended_by}
                onChange={(e) => setForm({ ...form, recommended_by: e.target.value })}
                placeholder="Name"
              />
            </label>
            <label className="gp-field">
              Departure - Time Out
              <input
                type="text"
                value={form.time_out}
                onChange={(e) => setForm({ ...form, time_out: e.target.value })}
                placeholder="e.g. 2040"
              />
            </label>
            <label className="gp-field">
              Arrival - Time In
              <input
                type="text"
                value={form.time_in}
                onChange={(e) => setForm({ ...form, time_in: e.target.value })}
                placeholder="Time"
              />
            </label>
          </div>
        </section>

        <button type="submit" className="gp-submit-btn" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : isEditMode
              ? 'Save changes (resets status to pending)'
              : 'Create Transmittal & Generate Barcode'}
        </button>
        {isEditMode && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: '0.75rem' }}
            onClick={() => navigate('/transmittal/history')}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
