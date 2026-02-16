import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';
import './Encoding.css';

const ROLES = [
  { value: 'scan_only', label: 'Scan only' },
  { value: 'encoding', label: 'Encoding' },
  { value: 'admin', label: 'Admin' },
];

export default function Users() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'encoding' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers();
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
    setForm({ username: '', password: '', full_name: '', role: 'encoding' });
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name || '',
      role: user.role || 'encoding',
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await updateUser(editingId, {
          username: form.username,
          password: form.password || undefined,
          full_name: form.full_name || null,
          role: form.role,
        });
      } else {
        if (!form.password.trim()) {
          setError('Password is required for new user.');
          return;
        }
        await createUser({
          username: form.username,
          password: form.password,
          full_name: form.full_name || null,
          role: form.role,
        });
      }
      await load();
      setEditingId(null);
      setForm({ username: '', password: '', full_name: '', role: 'encoding' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return;
    setError('');
    try {
      await deleteUser(id);
      await load();
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div className="encoding-loading">Loading users…</div>;

  return (
    <div className="encoding-page">
      <h1>User Encoding</h1>
      <p className="encoding-desc">Manage users and roles (Gate pass only, Scan only, Encoding, Admin).</p>
      {error && <div className="encoding-error">{error}</div>}
      <div className="encoding-actions">
        <button type="button" onClick={openCreate} className="btn-primary">Add User</button>
      </div>
      <div className="encoding-grid">
        <div className="encoding-list">
          <table className="encoding-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full name</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className={editingId === u.id ? 'editing' : ''}>
                  <td>{u.username}</td>
                  <td>{u.full_name || '—'}</td>
                  <td>{u.role || '—'}</td>
                  <td>
                    <button type="button" onClick={() => openEdit(u)} className="btn-sm">Edit</button>
                    <button type="button" onClick={() => handleDelete(u.id)} className="btn-sm btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="encoding-form-panel">
          <h2>{editingId ? 'Edit User' : 'New User'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Username *</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <label>{editingId ? 'New password (leave blank to keep)' : 'Password *'}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? 'Leave blank to keep' : ''}
              required={!editingId}
            />
            <label>Full name</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <label>Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
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
