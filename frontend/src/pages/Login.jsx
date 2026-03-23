import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';
import { canAccessPath, getDefaultPath } from '../utils/roles';
import './Login.css';

// When page is opened by IP (e.g. 192.168.100.20:5173), use same host for login so it works even if api.js is cached
function getLoginApiBase() {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname;
  if (h && h !== 'localhost' && h !== '127.0.0.1') {
    return window.location.protocol + '//' + h + ':8000';
  }
  return null;
}

export default function Login({ system: systemProp }) {
  const [system, setSystem] = useState(systemProp || 'gatepass');
  const systemLocked = !!systemProp;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiBaseUsed, setApiBaseUsed] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const defaultFrom = system === 'transmittal' ? '/transmittal' : '/gatepass';
  const from = location.state?.from?.pathname || defaultFrom;

  useEffect(() => {
    setApiBaseUsed(getLoginApiBase() || '(default from api.js)');
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const forcedBase = getLoginApiBase();
      let res;
      if (forcedBase) {
        const r = await fetch(forcedBase + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, system }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: r.statusText }));
          throw new Error(err.detail || r.statusText);
        }
        res = await r.json();
      } else {
        res = await apiLogin(username, password, system);
      }
      login(res.access_token, res.user);
      const role = res.user?.role || 'encoding';
      const userSystem = res.user?.system || 'gatepass';
      const target = canAccessPath(role, from, userSystem) ? from : getDefaultPath(role, userSystem);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (systemProp) setSystem(systemProp);
  }, [systemProp]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>CHERENZ GLOBAL MFG. INC.</h1>
        <h2>{system === 'transmittal' ? 'Transmittal' : 'Gate Pass'}</h2>
        <p className="login-subtitle">Sign in to continue</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          {!systemLocked && (
            <label>
              Sign in to
              <select
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                aria-label="System"
              >
                <option value="gatepass">Gate Pass</option>
                <option value="transmittal">Transmittal</option>
              </select>
            </label>
          )}
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
