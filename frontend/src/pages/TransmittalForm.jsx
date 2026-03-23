import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTransmittal } from '../api';
import { useAuth } from '../context/AuthContext';
import './Encoding.css';
import './GatePassForm.css';

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = () => ({ item_description: '', qty: 0, ref_doc_no: '', destination: '' });

export default function TransmittalForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTransmittal, setCreatedTransmittal] = useState(null);
  const [form, setForm] = useState({
    transmittal_date: today(),
    recipient_name: '',
    in_or_out: 'out',
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
    if (user?.full_name && !form.prepared_by) {
      setForm((f) => ({ ...f, prepared_by: user.full_name }));
    }
  }, [user]);

  useEffect(() => {
    if (createdTransmittal) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [createdTransmittal]);

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
    setSubmitting(true);
    setCreatedTransmittal(null);
    try {
      const payload = {
        transmittal_date: form.transmittal_date,
        recipient_name: form.recipient_name.trim() || '—',
        in_or_out: form.in_or_out,
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
      const result = await createTransmittal(payload);
      setCreatedTransmittal(result);
      setForm({ ...form, items: [emptyItem()] });
    } catch (e) {
      setError(e.message || 'Failed to create document transmittal');
    } finally {
      setSubmitting(false);
    }
  }

  function createAnother() {
    setCreatedTransmittal(null);
    setForm({
      ...form,
      transmittal_date: today(),
      recipient_name: '',
      items: [emptyItem()],
    });
  }

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Document Transmittal Form</h1>
      <p className="form-subtitle">CHERENZ GLOBAL MFG. INC. — DOCUMENT TRANSMITTAL SYSTEM</p>
      {error && <div className="gp-error">{error}</div>}
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
              Recipient name <span className="required">*</span>
              <input
                type="text"
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                placeholder="Person or entity receiving the documents"
                required
              />
            </label>
          </div>
          <div className="gp-radio-group">
            <span className="group-label">In / Out</span>
            <label>
              <input
                type="radio"
                name="in_out"
                checked={form.in_or_out === 'in'}
                onChange={() => setForm({ ...form, in_or_out: 'in' })}
              />
              In (items coming in)
            </label>
            <label>
              <input
                type="radio"
                name="in_out"
                checked={form.in_or_out === 'out'}
                onChange={() => setForm({ ...form, in_or_out: 'out' })}
              />
              Out (items going out)
            </label>
          </div>
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
          {submitting ? 'Saving…' : 'Create Transmittal & Generate Barcode'}
        </button>
      </form>
    </div>
  );
}
