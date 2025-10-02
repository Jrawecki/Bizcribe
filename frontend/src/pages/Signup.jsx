// frontend/src/pages/RegisterBusiness.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchJson } from '../utils/apiClient.js';
import AddressSearch from './Home/AddressSearch.jsx';
import MiniMap from './Home/MiniMap.jsx';
import { useAddressSearch } from './Home/hooks/useAddressSearch.js';

const emptyForm = {
  name: '',
  description: '',
  phone_number: '',
  address1: '',
  city: '',
  state: '',
  zip: '',
  location: '',
  lat: null,
  lng: null,
};

const ADDRESS_KEYS = ['address1', 'city', 'state', 'zip'];
const manualLocation = (data) => ADDRESS_KEYS.map((key) => data[key]).filter(Boolean).join(', ');

export default function Signup() {
  const { isAuthenticated, register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [addressMode, setAddressMode] = useState('search');
  const [account, setAccount] = useState({ email: '', password: '', display_name: '' });

  const addr = useAddressSearch();

  // Unified page: if not authenticated, show account creation section at top

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (addressMode === 'manual' && ADDRESS_KEYS.includes(key)) {
        next.location = manualLocation(next);
      }
      return next;
    });
  };

  const switchToManual = () => {
    setAddressMode('manual');
    addr.actions.unlock();
    setForm((prev) => ({ ...prev, location: manualLocation(prev) }));
  };

  const switchToSearch = () => {
    setAddressMode('search');
    addr.actions.unlock();
  };

  const disableSubmit =
    submitting ||
    (!isAuthenticated && (!account.email.trim() || !account.password.trim())) ||
    !form.name.trim() ||
    form.lat == null ||
    form.lng == null ||
    !(form.location && form.location.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (disableSubmit) return;

    setSubmitting(true);
    setError('');

    try {
      const bizPayload = {
        name: form.name,
        description: form.description || null,
        phone_number: form.phone_number || null,
        location: form.location || manualLocation(form),
        lat: form.lat,
        lng: form.lng,
        address1: form.address1 || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
      };

      if (!isAuthenticated) {
        await register({
          email: account.email,
          password: account.password,
          display_name: account.display_name,
          business: bizPayload,
        });
      } else {
        await fetchJson('/api/businesses/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bizPayload),
        });
      }

      setSubmitted(true);
      setForm(emptyForm);
      addr.actions.unlock();
      addr.state.setQuery('');
      addr.state.setOpen(false);
    } catch (e) {
      setError(e.message || 'Failed to submit business for review');
    } finally {
      setSubmitting(false);
    }
  }

  //

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--bg)] text-center gap-4 p-6">
        <h1 className="text-3xl font-semibold">Thanks! Your business is awaiting approval.</h1>
        <p className="max-w-md text-sm opacity-80">
          Our team will review the submission and publish it once it is approved. You can register another business at any time.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-full btn-primary" onClick={() => nav('/')}>Back to Home</button>
          <button className="px-4 py-2 rounded-full btn-ghost" onClick={() => setSubmitted(false)}>Register another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg)] text-[var(--text)] min-h-screen overflow-y-auto py-10">
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <h1 className="text-3xl font-semibold mb-2">Register a Business</h1>
        <p className="text-sm opacity-80 mb-6">
          Provide the business details below. We will review your submission and notify you once it is approved.
        </p>

        {error && <div className="text-red-300 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* removed duplicate top account card */}
          <div className="space-y-4">
            {!isAuthenticated && (
              <>
                <div>
                  <label className="block text-sm mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full p-3 rounded-lg"
                    value={account.email}
                    onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Username</label>
                  <input
                    className="w-full p-3 rounded-lg"
                    value={account.display_name}
                    onChange={(e) => setAccount((a) => ({ ...a, display_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Password</label>
                  <input
                    type="password"
                    className="w-full p-3 rounded-lg"
                    value={account.password}
                    onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm mb-1">Business name</label>
              <input
                className="w-full p-3 rounded-lg"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea
                className="w-full p-3 rounded-lg h-24 resize-none"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Phone number</label>
              <input
                className="w-full p-3 rounded-lg"
                value={form.phone_number}
                onChange={(e) => setField('phone_number', e.target.value)}
                required
              />
            </div>

            {addressMode === 'search' ? (
              <>
                <AddressSearch
                  state={addr.state}
                  actions={addr.actions}
                  onPick={(selection) => {
                    if (selection.lat != null && selection.lng != null) {
                      setForm((prev) => ({ ...prev, lat: selection.lat, lng: selection.lng }));
                    }
                    addr.state.setQuery(selection.label, { keepLocked: true });
                    addr.actions.lock();
                    setForm((prev) => ({
                      ...prev,
                      location: selection.label,
                      address1: selection.address?.line1 || prev.address1,
                      city: selection.address?.city || prev.city,
                      state: selection.address?.state || prev.state,
                      zip: selection.address?.zip || prev.zip,
                    }));
                  }}
                />
                <div className="flex items-center justify-between text-xs mt-1">
                  <p className="opacity-70">
                    Use the search box or map to find the location. We will capture the address automatically.
                  </p>
                  <button
                    type="button"
                    className="text-[var(--blue)] underline"
                    onClick={switchToManual}
                  >
                    Can't find the address?
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">Street</label>
                  <input
                    className="w-full p-3 rounded-lg"
                    value={form.address1}
                    onChange={(e) => setField('address1', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1">City</label>
                    <input
                      className="w-full p-3 rounded-lg"
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">State</label>
                    <input
                      className="w-full p-3 rounded-lg"
                      value={form.state}
                      onChange={(e) => setField('state', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">ZIP</label>
                    <input
                      className="w-full p-3 rounded-lg"
                      value={form.zip}
                      onChange={(e) => setField('zip', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <p className="opacity-70">
                    Enter the address manually, then drop a pin on the map to confirm the location.
                  </p>
                  <button
                    type="button"
                    className="text-[var(--blue)] underline"
                    onClick={switchToSearch}
                  >
                    Use address search
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50"
                disabled={disableSubmit}
              >
                {submitting ? 'Submitting...' : 'Next'}
              </button>
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => nav('/register-only')}
                  className="px-4 py-2 rounded-lg btn-ghost"
                >
                  Just sign up
                </button>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-4 h-[72vh]">
            <MiniMap
              value={{ lat: form.lat, lng: form.lng }}
              onChange={({ lat, lng }) =>
                setForm((prev) => ({
                  ...prev,
                  lat,
                  lng,
                  location:
                    addressMode === 'manual' && prev.location
                      ? prev.location
                      : prev.location || `Dropped pin (${lat?.toFixed?.(5)}, ${lng?.toFixed?.(5)})`,
                }))
              }
            />
          </div>
        </form>
      </div>
    </div>
  );
}
