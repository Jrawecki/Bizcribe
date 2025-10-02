// frontend/src/auth/RegisterOnly.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function SignupOnly() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      await register({
        email: form.email,
        password: form.password,
        display_name: form.display_name,
      });
      nav('/');
    } catch (e) {
      setErr('Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-[var(--bg)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md card rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Create your account</h1>
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
            <label className="block text-sm mb-1">Username</label>
            <input
              className="w-full p-3 rounded-lg"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
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
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="text-sm mt-4 text-center">
          Want to register a business? <Link to="/register-business" className="underline">Go here</Link>
        </div>
      </div>
    </div>
  );
}
