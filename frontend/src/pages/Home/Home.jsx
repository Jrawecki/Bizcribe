// src/pages/Home/Home.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddressSearch from './AddressSearch.jsx';
import { useAddressSearch } from './hooks/useAddressSearch.js';

const toKm = (mi) => Math.round(mi * 1.60934 * 100) / 100;
const isValidPoint = (point) =>
  !!point &&
  typeof point.lat === 'number' && Number.isFinite(point.lat) &&
  typeof point.lng === 'number' && Number.isFinite(point.lng);
const haversineMi = (a, b) => {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return (R * c) / 1.60934; // miles
};

export default function Home() {
  const [what, setWhat] = useState('');
  const [radiusMi, setRadiusMi] = useState(5);
  const [center, setCenter] = useState(null); // {lat,lng}
  const [centerLabel, setCenterLabel] = useState('your location');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Single instance of address search state/actions
  const addr = useAddressSearch();

  // Prevent geolocation from overwriting a user-picked address
  const centerLockedRef = useRef(false);

  // Load persisted state (what, radius). Do NOT persist/restore center.
  useEffect(() => {
    const savedWhat = localStorage.getItem('home_what');
    const savedRadius = localStorage.getItem('home_radius');
    if (savedWhat != null) setWhat(savedWhat);
    if (savedRadius != null) setRadiusMi(Number(savedRadius) || 5);
    // If geolocation permission already granted, auto-use location (no prompt).
    let cancelled = false;
    (async () => {
      if (!navigator?.geolocation) return;
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (cancelled) return;
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (cancelled) return;
                // Only apply geolocation if we don't already have a center (from user address) and not locked
                if (!centerLockedRef.current && !center) {
                  setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setCenterLabel('your location');
                }
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
            );
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [center]);

  const runSearch = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/businesses/', window.location.origin);
      url.searchParams.set('near', `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`);
      url.searchParams.set('radius_km', String(toKm(radiusMi)));
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to load nearby businesses');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Search failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [center, radiusMi]);

  // Persist state (do not persist center)
  useEffect(() => { localStorage.setItem('home_what', what || ''); }, [what]);
  useEffect(() => { localStorage.setItem('home_radius', String(radiusMi)); }, [radiusMi]);

  // Auto-run when center or radius changes
  useEffect(() => {
    if (center) runSearch();
  }, [center, radiusMi, runSearch]);

  const filtered = useMemo(() => {
    if (!what.trim()) return items;
    const q = what.toLowerCase();
    return items.filter((b) => (
      [(b.name || ''), (b.description || ''), (b.location || ''), (b.city || ''), (b.state || ''), (b.zip || '')]
        .join(' ') 
        .toLowerCase()
        .includes(q)
    ));
  }, [items, what]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Sticky search header */}
      <section className="sticky top-0 z-20 bg-[var(--bg)]/85 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-7xl mx-auto w-full px-4 py-4">
          <div className="panel rounded-xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h1 className="text-xl md:text-2xl font-extrabold">Find what's nearby</h1>
              <div className="hidden md:flex items-center gap-3">
                <Link to="/map" className="text-sm underline">Open map</Link>
              </div>
            </div>

            {/* Row 1: What + Distance + Right-side space */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">What are you looking for?</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-90" size={18} />
                  <input
                    value={what}
                    onChange={(e) => setWhat(e.target.value)}
                    placeholder="e.g., coffee, barber, bakery"
                    className="w-full pl-9 pr-3 rounded-lg h-12"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Radius</label>
                <select
                  value={radiusMi}
                  onChange={(e) => setRadiusMi(Number(e.target.value))}
                  className="w-full rounded-lg h-12"
                >
                  <option value={1}>Within 1 mi</option>
                  <option value={3}>Within 3 mi</option>
                  <option value={5}>Within 5 mi</option>
                  <option value={10}>Within 10 mi</option>
                  <option value={25}>Within 25 mi</option>
                </select>
              </div>

              <div className="md:col-span-7"></div>

              {/* Row 2: My address (same width as What) */}
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">My address</label>
                <AddressSearch
                  state={addr.state}
                  actions={addr.actions}
                  onPick={(selection) => {
                    if (selection.lat != null && selection.lng != null) {
                      centerLockedRef.current = true; // lock to user-picked address
                      setCenter({ lat: selection.lat, lng: selection.lng });
                    }
                    addr.state.setQuery(selection.label || '', { keepLocked: true });
                    addr.actions.lock();
                    setCenterLabel(selection.label || 'chosen address');
                  }}
                  hideLabel
                />
              </div>
              <div className="md:col-span-9"></div>
            </div>

            <div className="mt-3 text-sm opacity-80" aria-live="polite">
              {center ? (
                <>Showing {filtered.length} results within {radiusMi} mi of {centerLabel}</>
              ) : (
                <>Choose a location to see nearby businesses</>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 py-6">
          {error && <div className="text-red-400 mb-3">{error}</div>}
          {loading && (
            <ul className="space-y-3 animate-pulse" aria-hidden>
              {[...Array(5)].map((_, i) => (
                <li key={i} className="rounded-xl border border-[#2a2d30] p-4">
                  <div className="h-4 w-1/3 bg-[#101113] rounded mb-2"></div>
                  <div className="h-3 w-2/3 bg-[#101113] rounded mb-2"></div>
                  <div className="h-8 w-40 bg-[#101113] rounded"></div>
                </li>
              ))}
            </ul>
          )}

          {!loading && center && filtered.length === 0 && (
            <div className="opacity-80">No results. Try a different keyword, location, or distance.</div>
          )}

          {!loading && filtered.length > 0 && (
            <ul className="space-y-3">
              {filtered.map((b) => {
                const distance = haversineMi(center, b);
                const dLabel = typeof distance === 'number' && Number.isFinite(distance)
                  ? `${distance.toFixed(1)} mi`
                  : '';
                const directions = (typeof b.lat === 'number' && typeof b.lng === 'number')
                  ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.location || b.name)}`;
                return (
                  <li key={b.id} className="rounded-xl border border-[#2a2d30] p-4 bg-transparent">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link to={`/business/${b.id}`} className="text-xl font-semibold underline decoration-transparent hover:decoration-inherit truncate">
                            {b.name}
                          </Link>
                          {dLabel && (
                            <span className="chip text-xs px-2 py-0.5 inline-flex items-center gap-1">
                              <MapPin size={14} /> {dLabel}
                            </span>
                          )}
                        </div>
                        <div className="opacity-90 text-sm truncate">{b.location || [b.address1, b.city, b.state].filter(Boolean).join(', ')}</div>
                        {b.description && (
                          <div className="opacity-90 mt-1 text-sm line-clamp-2">
                            {b.description}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {b.phone_number && (
                          <a href={`tel:${b.phone_number}`} className="px-3 py-2 rounded-full btn-ghost inline-flex items-center gap-2">
                            <Phone size={16} /> Call
                          </a>
                        )}
                        <a href={directions} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-full btn-primary">
                          Directions
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <footer className="mt-auto border-t border-[#222] py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-white/70">
          &copy; {new Date().getFullYear()} Bizscribe - Map data &copy; OSM - Tiles & Geocoding by Mapbox
        </div>
      </footer>
    </div>
  );
}


