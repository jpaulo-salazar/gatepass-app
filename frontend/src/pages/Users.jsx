import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getDepartments } from '../api';
import { useAuth } from '../context/AuthContext';
import { getRoleDisplayLabel } from '../utils/roles';
import './Encoding.css';

const GATEPASS_ROLE_OPTIONS = [
  { value: 'scan_only', label: 'Scan only' },
  { value: 'encoding', label: 'Encoding' },
  { value: 'approve_only', label: 'Approve only' },
  { value: 'admin', label: 'Admin' },
];

const TRANSMITTAL_ROLE_OPTIONS = [
  { value: 'scan_only', label: 'Scan only' },
  { value: 'encoding', label: 'Encoding' },
  { value: 'approve_only', label: 'Approve only' },
  { value: 'admin', label: 'Admin' },
  { value: 'employee', label: 'Employee' },
];

export default function Users() {
  const { user: authUser } = useAuth();
  const isTransmittal = (authUser?.system || 'gatepass') === 'transmittal';
  const roleOptions = isTransmittal ? TRANSMITTAL_ROLE_OPTIONS : GATEPASS_ROLE_OPTIONS;
  const [departments, setDepartments] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', department_id: '', role: 'encoding' });

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

  useEffect(() => {
    if (!isTransmittal) {
      setDepartments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getDepartments();
        if (!cancelled) setDepartments(data || []);
      } catch (_) {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTransmittal]);

  function openCreate() {
    setEditingId(null);
    setForm({ username: '', password: '', full_name: '', department_id: '', role: 'encoding' });
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name || '',
      department_id: user.department_id != null ? String(user.department_id) : '',
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
          department_id: isTransmittal && form.department_id ? Number(form.department_id) : null,
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
          department_id: isTransmittal && form.department_id ? Number(form.department_id) : null,
          role: form.role,
        });
      }
      await load();
      setEditingId(null);
      setForm({ username: '', password: '', full_name: '', department_id: '', role: 'encoding' });
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
      <p className="encoding-desc">
        Manage users and roles
        {isTransmittal ? ' (Scan only, Encoding, Admin, Employee).' : ' (Scan only, Encoding, Admin).'}
      </p>
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
                <th>Department</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className={editingId === u.id ? 'editing' : ''}>
                  <td>{u.username}</td>
                  <td>{u.full_name || '—'}</td>
                  <td>{u.department || '—'}</td>
                  <td>{getRoleDisplayLabel(u.role)}</td>
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
            {isTransmittal && (
              <>
                <label>Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </>
            )}
            <label>Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {roleOptions.map((r) => (
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
