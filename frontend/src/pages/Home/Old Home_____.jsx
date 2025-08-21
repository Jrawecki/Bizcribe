import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Search, Phone, MapPin, Trash2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../index.css';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };

const MAPBOX_STYLES = {
  'Neon Night (Mapbox)': 'mapbox/navigation-night-v1',
  'Clean Light': 'mapbox/light-v11',
  'Modern Dark': 'mapbox/dark-v11',
  'Outdoors': 'mapbox/outdoors-v12',
  'Streets': 'mapbox/streets-v12',
  'Satellite Streets': 'mapbox/satellite-streets-v12',
};

function debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) console.error('VITE_MAPBOX_TOKEN is missing. Put it in frontend/.env and restart Vite.');

export default function Home() {
  const [businesses, setBusinesses] = useState([]);
  const [formData, setFormData] = useState({
    name: '', description: '', phone_number: '',
    address1: '', city: '', state: '', zip: '',
    location: '', lat: null, lng: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // address autocomplete
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrFetching, setAddrFetching] = useState(false);
  const [addrLocked, setAddrLocked] = useState(false); // collapse after 1 pick

  // manual address toggle (hidden by default)
  const [showManual, setShowManual] = useState(false);

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Load businesses
  useEffect(() => {
    setLoading(true);
    fetch('/api/businesses')
      .then((r) => r.json())
      .then(setBusinesses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = businesses.filter(
    (biz) =>
      biz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (biz.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const setField = (name, value) => setFormData((fd) => ({ ...fd, [name]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.lat == null || formData.lng == null || !formData.location) {
      setError('Please select/confirm an address (Use this location) before saving.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const payload = {
        name: formData.name, description: formData.description, phone_number: formData.phone_number,
        location: formData.location, lat: formData.lat, lng: formData.lng,
        address1: formData.address1, city: formData.city, state: formData.state, zip: formData.zip,
      };
      const res = await fetch('/api/businesses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add business');
      await refreshBusinesses();
      closeModal();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function refreshBusinesses() {
    const list = await fetch('/api/businesses').then((r) => r.json());
    setBusinesses(list);
  }

  async function deleteBusiness(id) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete business');
      setBusinesses((b) => b.filter((x) => x.id !== id));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // Map helpers
  const normalizeStylePath = (styleId) => (styleId.startsWith('styles/v1/') ? styleId : `styles/v1/${styleId}`);
  function createMapboxLayer(styleId) {
    const path = normalizeStylePath(styleId);
    const url = `https://api.mapbox.com/${path}/tiles/512/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`;
    return L.tileLayer(url, {
      tileSize: 512, zoomOffset: -1, maxZoom: 22,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
      detectRetina: true,
    });
  }

  // Initialize mini map when modal opens
  useEffect(() => {
    if (!showModal) return;

    const init = () => {
      if (mapRef.current) return;

      mapRef.current = L.map('address-preview-map', {
        center: [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng],
        zoom: 12, zoomControl: false,
      });

      const defaultStyle = 'mapbox/navigation-night-v1';
      const baseLayer = createMapboxLayer(defaultStyle).addTo(mapRef.current);
      mapRef.current._baseLayer = baseLayer;

      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 200);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => mapRef.current && mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 12),
          () => {}, { enableHighAccuracy: true }
        );
      }

      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        placeMarker(lat, lng);
      });
    };

    const t = setTimeout(init, 150);
    return () => clearTimeout(t);
  }, [showModal]);

  function placeMarker(lat, lng) {
    if (!mapRef.current) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    mapRef.current.setView([lat, lng], 15);
    setFormData((fd) => ({ ...fd, lat, lng }));
  }

  // Destroy map on close so it re-inits next time
  function destroyMap() {
    if (markerRef.current) { try { markerRef.current.remove(); } catch {} markerRef.current = null; }
    if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
  }

  // Address search (forward)
  const runSearch = debounce(async (query) => {
    if (!query || query.trim().length < 3) { setAddrSuggestions([]); return; }
    try {
      setAddrFetching(true); setError(null);
      const endpointBase = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
      const url = new URL(`${endpointBase}/${encodeURIComponent(query.trim())}.json`);
      url.searchParams.set('access_token', MAPBOX_TOKEN);
      url.searchParams.set('autocomplete', 'true');
      url.searchParams.set('country', 'US');
      url.searchParams.set('proximity', `${WILMINGTON_CENTER.lng},${WILMINGTON_CENTER.lat}`);
      url.searchParams.set('limit', '8');
      url.searchParams.set('types', 'address,place,postcode,poi');
      const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en-US' } });
      if (!res.ok) throw new Error('Address search failed');
      const data = await res.json();
      const suggestions = (data.features || []).map(parseMapboxFeatureToSuggestion);
      setAddrSuggestions(suggestions);
      setAddrOpen(true);
    } catch (err) {
      setError(err.message);
      setAddrSuggestions([]);
    } finally { setAddrFetching(false); }
  }, 250);

  useEffect(() => {
    if (!showModal || addrLocked) return; // don’t refetch when locked
    runSearch(addrQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrQuery, showModal, addrLocked]);

  function parseMapboxFeatureToSuggestion(f) {
    const [lng, lat] = f.center || [null, null];
    const label = f.place_name || '';
    const props = f.properties || {};
    const ctx = f.context || [];
    const byId = (idPrefix) => ctx.find((c) => (c.id || '').startsWith(idPrefix));
    const place = byId('place');
    const region = byId('region');
    const postcode = byId('postcode');
    const city = (place && (place.text || place.text_en)) || props.city || '';
    const state = (region && (region.short_code ? region.short_code.replace('US-', '') : region.text)) || props.state || '';
    const zip = (postcode && (postcode.text || postcode.text_en)) || props.postcode || '';
    let line1 = '';
    if (f.place_type?.includes('address')) line1 = [f.address, f.text].filter(Boolean).join(' ');
    else if (f.place_type?.includes('poi')) line1 = f.text || '';
    return { label, lat, lng, address: { line1, city, state, zip } };
  }

  function onPickSuggestion(s) {
    if (!s || s.lat == null || s.lng == null) return;
    placeMarker(s.lat, s.lng);
    setAddrQuery(s.label);
    setAddrOpen(false);
    setAddrLocked(true); // collapse after first click
    const a = s.address || {};
    setFormData((fd) => ({
      ...fd,
      address1: a.line1 || fd.address1,
      city: a.city || fd.city,
      state: a.state || fd.state,
      zip: a.zip || fd.zip,
    }));
  }

  // Reverse geocode
  async function reverseGeocode(lat, lng) {
    const endpointBase = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
    const url = new URL(`${endpointBase}/${lng},${lat}.json`);
    url.searchParams.set('access_token', MAPBOX_TOKEN);
    url.searchParams.set('types', 'address,place,postcode,poi');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'US');
    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en-US' } });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();
    const f = (data.features || [])[0];
    if (!f) return null;
    const s = parseMapboxFeatureToSuggestion(f);
    return { display_name: f.place_name, parsed: s };
  }

  async function confirmAddress() {
    try {
      if (formData.lat == null || formData.lng == null) {
        setError('Choose a suggestion or drop a pin first.');
        return;
      }
      let display = addrQuery?.trim();
      if (!display) {
        const rev = await reverseGeocode(formData.lat, formData.lng);
        display = rev?.display_name || `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
        const a = rev?.parsed?.address || {};
        setFormData((fd) => ({
          ...fd,
          address1: a.line1 || fd.address1,
          city: a.city || fd.city,
          state: a.state || fd.state,
          zip: a.zip || fd.zip,
        }));
        setAddrQuery(display);
      }
      setFormData((fd) => ({ ...fd, location: display }));
      setError(null);
    } catch (err) { setError(err.message); }
  }

  function clearModalState() {
    setFormData({
      name: '', description: '', phone_number: '',
      address1: '', city: '', state: '', zip: '',
      location: '', lat: null, lng: null,
    });
    setAddrQuery(''); setAddrSuggestions([]); setAddrOpen(false);
    setAddrLocked(false); setShowManual(false);
    destroyMap();
  }
  function closeModal() { clearModalState(); setShowModal(false); }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top controls under header: search + add */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-90" />
          <input
            type="text"
            placeholder="Search businesses or addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Cards (now gray) */}
      <div className="max-w-7xl mx-auto w-full px-4 pb-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((biz) => (
          <div key={biz.id} className="card p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-2">{biz.name}</h2>
            <p className="mb-4 opacity-95">{biz.description}</p>
            <div className="flex items-center gap-2 text-sm mb-2 opacity-95">
              <span className="chip inline-flex items-center justify-center w-6 h-6">
                <Phone size={14} />
              </span>
              {biz.phone_number}
            </div>
            <div className="flex items-center gap-2 text-sm opacity-95">
              <span className="chip inline-flex items-center justify-center w-6 h-6">
                <MapPin size={14} /> {/* same size as Phone */}
              </span>
              {biz.location}
            </div>
            <button
              onClick={() => deleteBusiness(biz.id)}
              className="mt-4 text-red-200 hover:text-red-100 transition"
              title="Delete"
            >
              <Trash2 />
            </button>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <p className="text-white/70 text-center mt-6">No businesses match your search.</p>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-[#222] py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-white/70">
          © {new Date().getFullYear()} Bizscribe · Map data © OSM · Tiles & Geocoding by Mapbox
        </div>
      </footer>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="panel rounded-xl shadow-xl w-full max-w-6xl p-6 modal-viewport">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Add a New Business</h3>
              <button onClick={closeModal} className="px-2 py-1 rounded btn-ghost" aria-label="Close modal">✕</button>
            </div>

            {/* Scrollable content */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 modal-scroll pr-1">
              {/* LEFT column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Name</label>
                  <input name="name" value={formData.name} onChange={(e) => setField('name', e.target.value)} required className="w-full p-3 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm mb-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={(e) => setField('description', e.target.value)} required className="w-full p-3 rounded-lg h-24 resize-none" />
                </div>

                <div>
                  <label className="block text-sm mb-1">Phone Number</label>
                  <input name="phone_number" value={formData.phone_number} onChange={(e) => setField('phone_number', e.target.value)} required className="w-full p-3 rounded-lg" />
                </div>

                {/* Address search (collapses after first pick) */}
                {!addrLocked ? (
                  <div className="relative">
                    <label className="block text-sm mb-1">Address search (US) — choose a suggestion or drop a pin</label>
                    <input
                      type="text"
                      value={addrQuery}
                      onChange={(e) => { setAddrQuery(e.target.value); setAddrOpen(true); }}
                      placeholder="e.g., 1007 N Orange St, Wilmington"
                      className="w-full p-3 rounded-lg"
                    />
                    {addrOpen && addrSuggestions.length > 0 && (
                      <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-[#2a2d30] bg-[#0f1012] shadow">
                        {addrSuggestions.map((s, idx) => (
                          <li key={`${s.label}-${idx}`} onClick={() => onPickSuggestion(s)} className="px-3 py-2 cursor-pointer hover:bg-[#131417]">
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Fixed-height status line to prevent shake */}
                    <div className="mt-1 text-sm min-h-[20px]">{addrFetching ? 'Searching…' : ''}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 rounded-full chip truncate max-w-[70%]">{addrQuery}</span>
                    <button type="button" onClick={() => { setAddrLocked(false); setAddrOpen(false); }} className="px-3 py-2 rounded-full btn-ghost">
                      Change
                    </button>
                  </div>
                )}

                {/* Reveal manual fields & pin-drop help */}
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="px-3 py-2 rounded-full chip"
                >
                  {showManual ? 'Hide manual address' : "Can't find address? (expand)"}
                </button>

                {showManual && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Street</label>
                      <input value={formData.address1} onChange={(e) => setField('address1', e.target.value)} placeholder="123 Main St" className="w-full p-3 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">City</label>
                      <input value={formData.city} onChange={(e) => setField('city', e.target.value)} placeholder="City" className="w-full p-3 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">State</label>
                        <input value={formData.state} onChange={(e) => setField('state', e.target.value)} placeholder="DE" className="w-full p-3 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Zip</label>
                        <input value={formData.zip} onChange={(e) => setField('zip', e.target.value)} placeholder="19801" className="w-full p-3 rounded-lg" />
                      </div>
                    </div>
                    <div className="text-xs">Tip: you can also click the map to drop/move a pin.</div>
                  </>
                )}

                {/* Confirm address */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={confirmAddress} className="px-3 py-2 rounded-lg btn-primary disabled:opacity-50" disabled={formData.lat == null || formData.lng == null}>
                    Use this location
                  </button>
                  <span className="text-xs">Pick a suggestion or drop a pin, then click “Use this location”, then Save.</span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg btn-ghost">Cancel</button>
                  <button type="submit" disabled={loading || formData.lat == null || formData.lng == null || !formData.location} className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50">
                    {loading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* RIGHT column: Minimap with style switcher */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Map Style</label>
                  <select
                    onChange={(e) => {
                      const styleId = e.target.value;
                      const m = mapRef.current;
                      if (!m) return;
                      if (m._baseLayer) m.removeLayer(m._baseLayer);
                      m._baseLayer = createMapboxLayer(styleId).addTo(m);
                    }}
                    className="text-sm px-2 py-1 rounded bg-[#0f1012] border border-[#2a2d30]"
                    defaultValue="mapbox/navigation-night-v1"
                  >
                    {Object.entries(MAPBOX_STYLES).map(([label, id]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>

                <div id="address-preview-map" className="w-full h-80 lg:h-full min-h-80 rounded-lg"></div>
                <div className="text-xs">Click the map to drop/move the pin.</div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
