import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, createGatePass } from '../api';
import { useAuth } from '../context/AuthContext';
import './Encoding.css';
import './GatePassForm.css';

const today = () => new Date().toISOString().slice(0, 10);

const emptyItem = () => ({ item_code: '', item_description: '', qty: 0, ref_doc_no: '', destination: '' });

export default function GatePassForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdGp, setCreatedGp] = useState(null);
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
    if (user && user.full_name && !form.prepared_by) {
      setForm((f) => ({ ...f, prepared_by: user.full_name }));
    }
  }, [user]);

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
    updateItem(index, 'item_code', product.item_code || '');
    updateItem(index, 'item_description', product.item_description || '');
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
    setSubmitting(true);
    setCreatedGp(null);
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
        return;
      }
      const result = await createGatePass(payload);
      setCreatedGp(result);
      setForm({
        ...form,
        items: [emptyItem()],
      });
    } catch (e) {
      setError(e.message || 'Failed to create gate pass');
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
    setForm(getInitialForm());
  }

  if (loading) return <div className="encoding-loading">Loading…</div>;

  return (
    <div className="gatepass-form-page encoding-page">
      <h1>Gate Pass Form</h1>
      <p className="form-subtitle">CHERENZ GLOBAL MFG. INC.</p>
      {error && <div className="gp-error">{error}</div>}
      {createdGp && (
        <div className="gp-success-msg">
          <strong>Gate pass created:</strong> GP#{createdGp.gp_number}
          <div className="gp-success-buttons">
            <button type="button" onClick={() => navigate('/print', { state: { gatePass: createdGp, variant: 'form' } })} className="btn-primary">Print form (with barcode)</button>
            <button type="button" onClick={createAnother} className="btn-secondary">Create another</button>
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
            <label className="gp-field">Attention
              <input type="text" value={form.attention} onChange={(e) => setForm({ ...form, attention: e.target.value })} placeholder="Attention" />
            </label>
          </div>
        </section>

        {/* Item Details */}
        <section className="gp-section">
          <h2 className="gp-section-title">Item Details</h2>
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
                    <select
                      value={it.item_code || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const used = usedItemCodesExcludingRow(i);
                          if (used.has(val)) return;
                          const p = products.find((x) => x.item_code === val);
                          if (p) setItemFromProduct(i, p);
                          else updateItem(i, 'item_code', val);
                        } else {
                          updateItem(i, 'item_code', '');
                          updateItem(i, 'item_description', '');
                        }
                      }}
                    >
                      <option value="">—</option>
                      {products.map((p) => {
                        const alreadyUsed = usedItemCodesExcludingRow(i).has(p.item_code);
                        return (
                          <option key={p.id} value={p.item_code} disabled={alreadyUsed}>
                            {p.item_code}{alreadyUsed ? ' (already added)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td>
                    <input
                      value={it.item_description}
                      onChange={(e) => updateItem(i, 'item_description', e.target.value)}
                      placeholder="Description"
                    />
                  </td>
                  <td>
                    <input type="number" min={0} value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} style={{ maxWidth: '70px' }} />
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
          {submitting ? 'Saving…' : 'Create Gate Pass & Generate Barcode'}
        </button>
      </form>
    </div>
  );
}
