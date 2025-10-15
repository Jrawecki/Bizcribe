// frontend/src/pages/Home/AddBusinessModal.jsx
import { useState } from 'react';
import AddressSearch from './AddressSearch.jsx';
import MiniMap from './MiniMap.jsx';
import { useAddressSearch } from './hooks/useAddressSearch.js';

const ADDRESS_KEYS = ['address1', 'city', 'state', 'zip'];
const manualLocation = (data) => ADDRESS_KEYS.map((key) => data[key]).filter(Boolean).join(', ');

export default function AddBusinessModal({ onClose, onSave, loading, errorMessage }) {
  const [form, setForm] = useState({
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
  });
  const [addressMode, setAddressMode] = useState('search');

  const addr = useAddressSearch();

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
    loading ||
    form.lat == null ||
    form.lng == null ||
    !(form.location && form.location.trim());

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 overflow-auto">
      <div
        className="panel rounded-xl shadow-xl w-full max-w-6xl p-6 modal-viewport"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Register a Business</h3>
          <button onClick={onClose} className="px-2 py-1 rounded btn-ghost" aria-label="Close modal">
            x
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...form, location: form.location || manualLocation(form) });
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 modal-scroll pr-1"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                className="w-full p-3 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                required
                className="w-full p-3 rounded-lg h-24 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Phone Number</label>
              <input
                value={form.phone_number}
                onChange={(e) => setField('phone_number', e.target.value)}
                required
                className="w-full p-3 rounded-lg"
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
                    Use the search box or map to select the correct address.
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

            {errorMessage && <div className="text-red-300 text-sm">{errorMessage}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg btn-ghost">
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableSubmit}
                className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Submit for review'}
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-4 h-[72vh]">
            <MiniMap
              value={{ lat: form.lat, lng: form.lng }}
              pinEnabled={addressMode === 'manual'}
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
