import { useState } from 'react';
import AddressSearch from './AddressSearch.jsx';
import MiniMap from './MiniMap.jsx';
import { useAddressSearch } from './hooks/useAddressSearch.js';

export default function AddBusinessModal({ onClose, onSave, loading }) {
  const [form, setForm] = useState({
    name:'', description:'', phone_number:'',
    address1:'', city:'', state:'', zip:'',
    location:'', lat:null, lng:null
  });

  const addr = useAddressSearch();
  const setField = (k, v) => setForm(f => ({...f, [k]: v}));

  async function confirmAddress() {
    if (form.lat == null || form.lng == null) return;
    if (!form.location) setField('location', addr.state.query);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
      <div className="panel rounded-xl shadow-xl w-full max-w-6xl p-6 modal-viewport">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Add a New Business</h3>
          <button onClick={onClose} className="px-2 py-1 rounded btn-ghost" aria-label="Close modal">✕</button>
        </div>

        <form onSubmit={(e)=>{e.preventDefault(); onSave(form);}}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 modal-scroll pr-1">
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input value={form.name} onChange={e=>setField('name', e.target.value)} required className="w-full p-3 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea value={form.description} onChange={e=>setField('description', e.target.value)} required className="w-full p-3 rounded-lg h-24 resize-none" />
            </div>
            <div>
              <label className="block text-sm mb-1">Phone Number</label>
              <input value={form.phone_number} onChange={e=>setField('phone_number', e.target.value)} required className="w-full p-3 rounded-lg" />
            </div>

            <AddressSearch
              state={addr.state}
              actions={addr.actions}
              onPick={(s) => {
                if (s.lat!=null && s.lng!=null) setForm(f=>({...f, lat:s.lat, lng:s.lng}));
                addr.state.setQuery(s.label);
                setField('location', s.label);
                const a = s.address||{};
                setForm(f=>({...f,
                  address1: a.line1 || f.address1,
                  city: a.city || f.city,
                  state: a.state || f.state,
                  zip: a.zip || f.zip
                }));
              }}
            />

            <div className="flex items-center gap-2">
              <button type="button" onClick={confirmAddress}
                className="px-3 py-2 rounded-lg btn-primary disabled:opacity-50"
                disabled={form.lat==null || form.lng==null}>
                Use this location
              </button>
              <span className="text-xs">Pick a suggestion or drop a pin, then click “Use this location”, then Save.</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg btn-ghost">Cancel</button>
              <button type="submit" disabled={loading || form.lat==null || form.lng==null || !form.location}
                      className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <MiniMap
            value={{ lat: form.lat, lng: form.lng }}
            onChange={({lat,lng}) => setForm(f=>({ ...f, lat, lng }))}
          />
        </form>
      </div>
    </div>
  );
}
