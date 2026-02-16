import { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';
import './Encoding.css';

export default function Products() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [inlineForm, setInlineForm] = useState({ item_code: '', item_description: '', item_group: '' });
  const [form, setForm] = useState({ item_code: '', item_description: '', item_group: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getProducts();
      setList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ item_code: '', item_description: '', item_group: '' });
  }

  function openEdit(product) {
    setEditingId(product.id);
    setInlineForm({ item_code: product.item_code, item_description: product.item_description, item_group: product.item_group || '' });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await createProduct(form);
      await load();
      setForm({ item_code: '', item_description: '', item_group: '' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleInlineSave() {
    if (!editingId) return;
    setError('');
    try {
      await updateProduct(editingId, inlineForm);
      await load();
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    setError('');
    try {
      await deleteProduct(id);
      await load();
      if (editingId === id) {
        setEditingId(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div className="encoding-loading">Loading products…</div>;

  return (
    <div className="encoding-page">
      <h1>Product Encoding</h1>
      <p className="encoding-desc">Manage item no., description, and group for gate pass line items.</p>
      {error && <div className="encoding-error">{error}</div>}
      <div className="encoding-actions">
        <button type="button" onClick={openCreate} className="btn-primary">Add Product</button>
      </div>
      <div className="encoding-grid">
        <div className="encoding-list">
          <table className="encoding-table">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Item Description</th>
                <th>Item Group</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={editingId === p.id ? 'editing' : ''}>
                  {editingId === p.id ? (
                    <>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_code}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_code: e.target.value }))}
                          placeholder="Item No."
                        />
                      </td>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_description}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_description: e.target.value }))}
                          placeholder="Item Description"
                        />
                      </td>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_group}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_group: e.target.value }))}
                          placeholder="Item Group"
                        />
                      </td>
                      <td className="encoding-actions-cell">
                        <button type="button" onClick={handleInlineSave} className="btn-sm btn-primary-sm">Save</button>
                        <button type="button" onClick={cancelEdit} className="btn-sm">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{p.item_code}</td>
                      <td>{p.item_description}</td>
                      <td>{p.item_group || '—'}</td>
                      <td className="encoding-actions-cell">
                        <button type="button" onClick={() => openEdit(p)} className="btn-sm">Edit</button>
                        <button type="button" onClick={() => handleDelete(p.id)} className="btn-sm btn-danger">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="encoding-form-panel">
          <h2>New Product</h2>
          <form onSubmit={handleSubmit}>
            <label>Item No. *</label>
            <input
              value={form.item_code}
              onChange={(e) => setForm({ ...form, item_code: e.target.value })}
              placeholder="e.g. AC.CF-COOL1"
              required
            />
            <label>Item Description *</label>
            <input
              value={form.item_description}
              onChange={(e) => setForm({ ...form, item_description: e.target.value })}
              required
            />
            <label>Item Group</label>
            <input
              value={form.item_group}
              onChange={(e) => setForm({ ...form, item_group: e.target.value })}
              placeholder="e.g. AIR COOLER, AUTO EQUIPMENT"
            />
            <div className="form-actions">
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
