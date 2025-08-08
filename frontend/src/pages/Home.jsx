import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Search, Phone, MapPin, Trash2, Sun, Moon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../index.css';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };

// Mapbox styles to pick from (add your Studio style below)
const MAPBOX_STYLES = {
  'Neon Night (Mapbox)': 'mapbox/navigation-night-v1',
  'Clean Light': 'mapbox/light-v11',
  'Modern Dark': 'mapbox/dark-v11',
  'Outdoors': 'mapbox/outdoors-v12',
  'Streets': 'mapbox/streets-v12',
  'Satellite Streets': 'mapbox/satellite-streets-v12',
  // Example: 'Your Studio Theme': '<your_username>/<your_style_id>',
};

// Simple debounce
function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Pull Mapbox token from Vite env
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error('VITE_MAPBOX_TOKEN is missing. Put it in frontend/.env and restart Vite.');
}

export default function Home() {
  const [businesses, setBusinesses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone_number: '',
    // split address fields (editable)
    address1: '',
    city: '',
    state: '',
    zip: '',
    // final display + coordinates
    location: '',
    lat: null,
    lng: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // address autocomplete state (one input)
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrFetching, setAddrFetching] = useState(false);

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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

  function setField(name, value) {
    setFormData((fd) => ({ ...fd, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Require the confirm step
    if (formData.lat == null || formData.lng == null || !formData.location) {
      setError('Please select/confirm an address (Use this location) before saving.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        phone_number: formData.phone_number,
        location: formData.location,
        lat: formData.lat,
        lng: formData.lng,
        address1: formData.address1,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
      };

      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add business');

      await refreshBusinesses();
      clearModalState();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshBusinesses() {
    const list = await fetch('/api/businesses').then((r) => r.json());
    setBusinesses(list);
  }

  async function deleteBusiness(id) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete business');
      setBusinesses((b) => b.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Ensure styles/v1 prefix regardless of how styleId is provided
  function normalizeStylePath(styleId) {
    return styleId.startsWith('styles/v1/') ? styleId : `styles/v1/${styleId}`;
  }

  function createMapboxLayer(styleId) {
    const path = normalizeStylePath(styleId);
    const url = `https://api.mapbox.com/${path}/tiles/512/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`;

    // Helpful for debugging in Network tab
    // console.log('Mapbox tile URL sample:', url.replace('{z}','12').replace('{x}','1205').replace('{y}','1536').replace('{r}',''));

    return L.tileLayer(url, {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 22,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
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
        zoom: 12,
        zoomControl: false,
      });

      // Default style (slick preset)
      const defaultStyle = 'mapbox/navigation-night-v1';
      const baseLayer = createMapboxLayer(defaultStyle).addTo(mapRef.current);
      mapRef.current._baseLayer = baseLayer; // stash for switching

      // invalidate size after a tick so it renders reliably
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 200);

      // Try user location (optional)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current && mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 12);
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }

      // Allow clicking map to drop/move the pin
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
    // Only set coords; we won't set "location" text until the user confirms
    setFormData((fd) => ({ ...fd, lat, lng }));
  }

  // -----------------------------
  // Mapbox Geocoding (forward)
  // -----------------------------
  const runSearch = debounce(async (query) => {
    if (!query || query.trim().length < 3) {
      setAddrSuggestions([]);
      return;
    }
    try {
      setAddrFetching(true);
      setError(null);

      const endpointBase = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
      const url = new URL(`${endpointBase}/${encodeURIComponent(query.trim())}.json`);
      url.searchParams.set('access_token', MAPBOX_TOKEN);
      url.searchParams.set('autocomplete', 'true');
      url.searchParams.set('country', 'US'); // strong US bias
      // bias towards Wilmington
      url.searchParams.set('proximity', `${WILMINGTON_CENTER.lng},${WILMINGTON_CENTER.lat}`);
      url.searchParams.set('limit', '8');
      // prioritize addresses/places; include postcode too
      url.searchParams.set('types', 'address,place,postcode,poi');

      const res = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'en-US' },
      });
      if (!res.ok) throw new Error('Address search failed');

      const data = await res.json();
      const suggestions = (data.features || []).map(parseMapboxFeatureToSuggestion);
      setAddrSuggestions(suggestions);
      setAddrOpen(true);
    } catch (err) {
      setError(err.message);
      setAddrSuggestions([]);
    } finally {
      setAddrFetching(false);
    }
  }, 250);

  useEffect(() => {
    if (!showModal) return;
    runSearch(addrQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrQuery, showModal]);

  function parseMapboxFeatureToSuggestion(f) {
    // center: [lng, lat]
    const [lng, lat] = f.center || [null, null];
    // place_name is a nice display label
    const label = f.place_name || '';

    // Try to derive address bits from properties/context
    const props = f.properties || {};
    const ctx = f.context || [];
    const byId = (idPrefix) => ctx.find((c) => (c.id || '').startsWith(idPrefix));

    const place = byId('place'); // city/town
    const region = byId('region'); // state
    const postcode = byId('postcode'); // zip

    const city =
      (place && (place.text || place.text_en)) ||
      props.city ||
      '';
    const state =
      (region && (region.short_code ? region.short_code.replace('US-', '') : region.text)) ||
      props.state ||
      '';
    const zip =
      (postcode && (postcode.text || postcode.text_en)) ||
      props.postcode ||
      '';

    let line1 = '';
    if (f.place_type?.includes('address')) {
      // address result: f.address (number) + f.text (street)
      line1 = [f.address, f.text].filter(Boolean).join(' ');
    } else if (f.place_type?.includes('poi')) {
      // POI: use text as name; street is trickier—skip line1
      line1 = f.text || '';
    } else if (f.place_type?.includes('place')) {
      // City-level result; leave line1 empty
      line1 = '';
    }

    return {
      label,
      lat,
      lng,
      address: { line1, city, state, zip },
    };
  }

  function onPickSuggestion(s) {
    if (!s || s.lat == null || s.lng == null) return;
    placeMarker(s.lat, s.lng);
    setAddrQuery(s.label);
    setAddrOpen(false);
    // Stage parsed address bits (editable before confirm)
    const a = s.address || {};
    setFormData((fd) => ({
      ...fd,
      address1: a.line1 || fd.address1,
      city: a.city || fd.city,
      state: a.state || fd.state,
      zip: a.zip || fd.zip,
    }));
  }

  // -----------------------------
  // Mapbox Reverse Geocode
  // -----------------------------
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

    // Reuse parser for consistency
    const s = parseMapboxFeatureToSuggestion(f);
    return { display_name: f.place_name, parsed: s };
  }

  async function confirmAddress() {
    try {
      if (formData.lat == null || formData.lng == null) {
        setError('Pick a suggestion or drop a pin on the map first.');
        return;
      }

      let display = addrQuery?.trim();
      if (!display) {
        // No suggestion text? Populate via reverse geocode
        const rev = await reverseGeocode(formData.lat, formData.lng);
        if (rev) {
          display = rev.display_name || `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
          const a = rev.parsed?.address || {};
          setFormData((fd) => ({
            ...fd,
            address1: a.line1 || fd.address1,
            city: a.city || fd.city,
            state: a.state || fd.state,
            zip: a.zip || fd.zip,
          }));
          setAddrQuery(display);
        } else {
          display = `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
        }
      }

      setFormData((fd) => ({ ...fd, location: display }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function clearModalState() {
    setFormData({
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
    setAddrQuery('');
    setAddrSuggestions([]);
    setAddrOpen(false);
    if (markerRef.current) {
      try { markerRef.current.remove(); } catch {}
      markerRef.current = null;
    }
    if (mapRef.current) {
      try { mapRef.current.setView([WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng], 12); } catch {}
    }
  }

  function closeModal() {
    clearModalState();
    setShowModal(false);
  }

  // If user edits the address box again after confirming, unset the confirmed "location"
  useEffect(() => {
    if (!showModal) return;
    setFormData((fd) => ({ ...fd, location: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrQuery]);

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900 transition-colors duration-500">
      {/* Header */}
      <header className="flex items-center justify-between p-6 bg-indigo-600 dark:bg-gray-800 text-white shadow-lg">
        <h1 className="text-3xl font-extrabold tracking-widest">PlaceHolder</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-indigo-500 dark:bg-gray-700 rounded-full hover:bg-indigo-400 dark:hover:bg-gray-600 transition"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-gray-200" />}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-full shadow hover:shadow-md transition"
          >
            <PlusCircle className="mr-2" /> Add Business
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto py-8 px-6">
        {/* Search */}
        <div className="max-w-6xl mx-auto mb-6 flex items-center">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search businesses or addresses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

        {/* Cards */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((biz) => (
            <div
              key={biz.id}
              className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-colors duration-300"
            >
              <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{biz.name}</h2>
              <p className="mb-4 text-gray-800 dark:text-gray-300">{biz.description}</p>
              <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-2">
                <Phone className="mr-2" size={16} /> {biz.phone_number}
              </div>
              <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                <MapPin className="mr-2" size={16} /> {biz.location}
              </div>
              <button
                onClick={() => deleteBusiness(biz.id)}
                className="mt-4 self-end text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 transition"
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center mt-12">No businesses match your search.</p>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-200 dark:bg-gray-800 py-4 shadow-inner">
        <div className="max-w-6xl mx-auto text-center text-gray-700 dark:text-gray-400 text-sm">
          © {new Date().getFullYear()} PlaceHolder. All rights reserved. · Map data © OSM · Tiles & Geocoding by Mapbox
        </div>
      </footer>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add a New Business</h3>
              <button
                onClick={closeModal}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 2 columns: form left, minimap right */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[70vh] overflow-auto pr-1">
              {/* LEFT column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) => setField('description', e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setField('phone_number', e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                  />
                </div>

                {/* ONE address box with predictions */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address search (US) — type and choose, or drop a pin
                  </label>
                  <input
                    type="text"
                    value={addrQuery}
                    onChange={(e) => {
                      setAddrQuery(e.target.value);
                      setAddrOpen(true);
                    }}
                    placeholder="e.g., 1007 N Orange St, Wilmington"
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                  />
                  {addrOpen && addrSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow">
                      {addrSuggestions.map((s, idx) => (
                        <li
                          key={`${s.label}-${idx}`}
                          onClick={() => onPickSuggestion(s)}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                        >
                          {s.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {addrFetching && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Searching…</div>}
                </div>

                {/* Split fields (auto-filled, but editable) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Street</label>
                  <input
                    value={formData.address1}
                    onChange={(e) => setField('address1', e.target.value)}
                    placeholder="123 Main St"
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input
                    value={formData.city}
                    onChange={(e) => setField('city', e.target.value)}
                    placeholder="City"
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      value={formData.state}
                      onChange={(e) => setField('state', e.target.value)}
                      placeholder="DE"
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip</label>
                    <input
                      value={formData.zip}
                      onChange={(e) => setField('zip', e.target.value)}
                      placeholder="19801"
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white"
                    />
                  </div>
                </div>

                {/* Confirm address */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmAddress}
                    className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition disabled:opacity-50"
                    disabled={formData.lat == null || formData.lng == null}
                  >
                    Use this location
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Choose a suggestion or drop a pin, then click “Use this location”, then Save.
                  </span>
                </div>

                {/* Readonly preview of what will be saved */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                    <input
                      value={formData.lat ?? ''}
                      readOnly
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                    <input
                      value={formData.lng ?? ''}
                      readOnly
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Selected Address</label>
                  <input
                    value={formData.location}
                    readOnly
                    placeholder="(not confirmed yet)"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || formData.lat == null || formData.lng == null || !formData.location}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* RIGHT column: Minimap with style switcher */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">Map Style</label>
                  <select
                    onChange={(e) => {
                      const styleId = e.target.value;
                      const m = mapRef.current;
                      if (!m) return;
                      // remove old layer
                      if (m._baseLayer) m.removeLayer(m._baseLayer);
                      // add new one
                      m._baseLayer = createMapboxLayer(styleId).addTo(m);
                    }}
                    className="border text-sm px-2 py-1 rounded bg-white dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
                    defaultValue="mapbox/navigation-night-v1"
                  >
                    {Object.entries(MAPBOX_STYLES).map(([label, id]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>

                <div id="address-preview-map" className="w-full h-80 lg:h-full min-h-80 rounded-lg"></div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Tip: click the map to drop/move the pin if your address isn’t in the list.
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
