import { useState, useEffect } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../api';
import './Encoding.css';

export default function Departments() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', is_reception_desk: false });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getDepartments();
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
    setForm({ name: '', is_reception_desk: false });
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ name: row.name || '', is_reception_desk: !!row.is_reception_desk });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const name = form.name.trim();
    if (!name) {
      setError('Department name is required.');
      return;
    }
    try {
      if (editingId) {
        await updateDepartment(editingId, { name, is_reception_desk: form.is_reception_desk });
      } else {
        await createDepartment({ name, is_reception_desk: form.is_reception_desk });
      }
      await load();
      setEditingId(null);
      setForm({ name: '', is_reception_desk: false });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this department? Users assigned to it will lose the assignment.')) return;
    setError('');
    try {
      await deleteDepartment(id);
      await load();
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div className="encoding-loading">Loading departments…</div>;

  return (
    <div className="encoding-page">
      <h1>Department Encoding</h1>
      <p className="encoding-desc">Maintain the department list. User encoding assigns each user to a department from this list. Mark one department as <strong>Reception desk</strong> so scan-only users in that department can use Receptionist Scan (they can still use Recipient Scan).</p>
      {error && <div className="encoding-error">{error}</div>}
      <div className="encoding-actions">
        <button type="button" onClick={openCreate} className="btn-primary">Add Department</button>
      </div>
      <div className="encoding-grid">
        <div className="encoding-list">
          <table className="encoding-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Reception desk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className={editingId === d.id ? 'editing' : ''}>
                  <td>{d.name}</td>
                  <td>{d.is_reception_desk ? 'Yes' : '—'}</td>
                  <td>
                    <button type="button" onClick={() => openEdit(d)} className="btn-sm">Edit</button>
                    <button type="button" onClick={() => handleDelete(d.id)} className="btn-sm btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="encoding-form-panel">
          <h2>{editingId ? 'Edit Department' : 'New Department'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="encoding-checkbox-row">
              <input
                type="checkbox"
                checked={form.is_reception_desk}
                onChange={(e) => setForm({ ...form, is_reception_desk: e.target.checked })}
              />
              Reception desk (scan-only users in this department can open Receptionist Scan)
            </label>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Save</button>
              {editingId && (
                <button type="button" onClick={openCreate} className="btn-secondary">Cancel</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
