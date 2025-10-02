// src/pages/Home/Home.jsx
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import BusinessList from './BusinessList.jsx';
import { useBusinesses } from './hooks/useBusinesses.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { businesses, loading, error, remove, manageableIds } = useBusinesses({ includeMine: isAuthenticated });
  const [q, setQ] = useState('');
  const [actionError, setActionError] = useState('');

  const filtered = useMemo(
    () =>
      businesses.filter((b) =>
        ((b.name || '') + ' ' + (b.location || '') + ' ' + (b.city || '') + ' ' + (b.state || '') + ' ' + (b.zip || ''))
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [businesses, q]
  );

  async function handleDelete(id) {
    setActionError('');
    try {
      await remove(id);
    } catch (e) {
      setActionError(e.message || 'Unable to delete business');
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
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
      </div>

      {error && <p className="text-red-400 text-center mb-2">Error: {error}</p>}
      {actionError && <p className="text-red-400 text-center mb-2">{actionError}</p>}

      {!loading && (
        <BusinessList items={filtered} onDelete={handleDelete} manageableIds={manageableIds} />
      )}

      <footer className="mt-auto border-t border-[#222] py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-white/70">
          &copy; {new Date().getFullYear()} Bizscribe - Map data &copy; OSM - Tiles & Geocoding by Mapbox
        </div>
      </footer>
    </div>
  );
}
