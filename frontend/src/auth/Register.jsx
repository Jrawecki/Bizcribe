// frontend/src/auth/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'USER', // USER or BUSINESS
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await register(form);
      nav('/');
    } catch (e) {
      setErr('Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-8 card rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full p-3 rounded-lg"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full p-3 rounded-lg"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Display name</label>
          <input
            className="w-full p-3 rounded-lg"
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Account type</label>
          <select
            className="w-full p-3 rounded-lg bg-[#101113] border-[#2a2d30]"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          >
            <option value="USER">User (reviews, check‑ins)</option>
            <option value="BUSINESS">Business (manage businesses)</option>
          </select>
        </div>

        {err && <div className="text-red-300 text-sm">{err}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-lg btn-primary disabled:opacity-60">
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="text-sm mt-4">
        Already have an account? <Link to="/login" className="underline">Sign in</Link>
      </div>
    </div>
  );
}
