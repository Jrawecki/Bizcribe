// src/pages/Home/Home.jsx
import { useMemo, useState } from 'react';
import { Search, PlusCircle } from 'lucide-react';
import BusinessList from './BusinessList.jsx';
import AddBusinessModal from './AddBusinessModal.jsx';
import { useBusinesses } from './hooks/useBusinesses.js';

export default function Home() {
  const { businesses, loading, error, create, remove } = useBusinesses();
  const [showModal, setShowModal] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () =>
      businesses.filter((b) =>
        ((b.name || '') + ' ' + (b.location || ''))
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [businesses, q]
  );

  async function handleSave(form) {
    await create({
      name: form.name,
      description: form.description,
      phone_number: form.phone_number,
      location: form.location,
      lat: form.lat,
      lng: form.lng,
      address1: form.address1,
      city: form.city,
      state: form.state,
      zip: form.zip,
    });
    setShowModal(false);
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar: search + add */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-90" />
          <input
            type="text"
            placeholder="Search businesses or addresses..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-full border border-[#2a2d30] bg-[var(--blue)] text-white placeholder-white/70 shadow-sm focus:outline-none"
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full btn-primary shadow"
        >
          <PlusCircle size={18} /> Add Business
        </button>
      </div>

      {error && <p className="text-red-400 text-center mb-2">Error: {error}</p>}

      {!loading && <BusinessList items={filtered} onDelete={remove} />}

      <footer className="mt-auto border-t border-[#222] py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-white/70">
          © {new Date().getFullYear()} Bizscribe · Map data © OSM · Tiles & Geocoding by Mapbox
        </div>
      </footer>

      {showModal && (
        <AddBusinessModal
          loading={loading}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

