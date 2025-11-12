// frontend/src/auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      await login(form.email, form.password);
      nav('/');
    } catch {
      setErr('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-[var(--bg)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md card rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Sign in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full p-3 rounded-lg"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 rounded-lg"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          {err && <div className="text-red-300 text-sm">{err}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg btn-primary disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="text-sm mt-4 text-center">
          Don't have an account? <Link to="/register" className="underline">Create one</Link>
        </div>
      </div>
    </div>
  );
}
