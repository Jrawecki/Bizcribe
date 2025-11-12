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
  });
  const [addBusiness, setAddBusiness] = useState(false);
  const [biz, setBiz] = useState({
    name: '',
    description: '',
    phone_number: '',
    address1: '',
    city: '',
    state: '',
    zip: '',
    location: '',
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      let business;
      if (addBusiness && biz.name.trim()) {
        business = {
          name: biz.name.trim(),
          description: biz.description || null,
          phone_number: biz.phone_number || null,
          location: biz.location || null,
          address1: biz.address1 || null,
          city: biz.city || null,
          state: biz.state || null,
          zip: biz.zip || null,
          lat: null,
          lng: null,
        };
      }
      await register({
        email: form.email,
        password: form.password,
        display_name: form.display_name,
        business,
      });
      nav('/');
    } catch {
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
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 rounded-lg"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Display name</label>
            <input
              className="w-full p-3 rounded-lg"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>

          <div className="text-sm">
            <button
              type="button"
              className="text-[var(--blue)] underline bg-transparent border-0 p-0"
              onClick={() => setAddBusiness((v) => !v)}
            >
              {addBusiness ? 'Cancel adding a business' : 'Register a business now'}
            </button>
          </div>

          {addBusiness && (
            <div className="card rounded-xl p-4 space-y-3">
              <div className="text-sm opacity-80">Optional: include your business details to submit for review.</div>
              <div>
                <label className="block text-sm mb-1">Business name</label>
                <input
                  className="w-full p-3 rounded-lg"
                  value={biz.name}
                  onChange={(e) => setBiz((b) => ({ ...b, name: e.target.value }))}
                  placeholder="Acme Coffee"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full p-3 rounded-lg"
                  rows={3}
                  value={biz.description}
                  onChange={(e) => setBiz((b) => ({ ...b, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input
                  className="w-full p-3 rounded-lg"
                  value={biz.phone_number}
                  onChange={(e) => setBiz((b) => ({ ...b, phone_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Street</label>
                <input
                  className="w-full p-3 rounded-lg"
                  value={biz.address1}
                  onChange={(e) => setBiz((b) => ({ ...b, address1: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">City</label>
                  <input
                    className="w-full p-3 rounded-lg"
                    value={biz.city}
                    onChange={(e) => setBiz((b) => ({ ...b, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">State</label>
                  <input
                    className="w-full p-3 rounded-lg"
                    value={biz.state}
                    onChange={(e) => setBiz((b) => ({ ...b, state: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">ZIP</label>
                  <input
                    className="w-full p-3 rounded-lg"
                    value={biz.zip}
                    onChange={(e) => setBiz((b) => ({ ...b, zip: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Location description</label>
                <input
                  className="w-full p-3 rounded-lg"
                  placeholder="Downtown, near the park"
                  value={biz.location}
                  onChange={(e) => setBiz((b) => ({ ...b, location: e.target.value }))}
                />
              </div>
            </div>
          )}

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
          Already have an account? <Link to="/login" className="underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
