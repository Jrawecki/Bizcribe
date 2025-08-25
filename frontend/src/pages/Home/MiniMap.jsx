// src/pages/Home/MiniMap.jsx
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import "../../utils/mapIconSetup.js";
import { createMapboxLayer, MAPBOX_STYLES } from "../../utils/mapboxTiles.js";

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };

export default function MiniMap({ value, onChange }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Toggle for manual pin placement
  const [dropMode, setDropMode] = useState(true);
  const dropModeRef = useRef(dropMode);
  useEffect(() => { dropModeRef.current = dropMode; }, [dropMode]);

  // Helper: place/move marker without changing zoom
  const place = (lat, lng, { center = true } = {}) => {
    const m = mapRef.current; if (!m) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(m);
    }
    if (center) m.panTo([lat, lng]); // keep current zoom level
    onChange?.({ lat, lng });
  };

  // One-time map init
  useEffect(() => {
    const m = L.map('address-preview-map', {
      center: [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng],
      zoom: 12,
      zoomControl: false
    });

    const base = createMapboxLayer('mapbox/navigation-night-v1').addTo(m);
    m._baseLayer = base;

    setTimeout(() => m.invalidateSize(), 200);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => m.setView([pos.coords.latitude, pos.coords.longitude], 12),
        () => {},
        { enableHighAccuracy: true }
      );
    }

    // click-to-drop (gated by toggle)
    const onClick = (e) => {
      if (!dropModeRef.current) return;
      place(e.latlng.lat, e.latlng.lng);
    };
    m.on('click', onClick);

    // initial pin if provided
    if (value?.lat != null && value?.lng != null) {
      place(value.lat, value.lng, { center: true });
    }

    mapRef.current = m;
    return () => { m.off('click', onClick); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to address selection
  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      place(value.lat, value.lng, { center: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // View close-up: switch to Satellite + zoom tight on pin
  const handleViewCloseup = () => {
    const m = mapRef.current;
    if (!m || value?.lat == null || value?.lng == null) return;

    // Switch base layer to Satellite Streets
    if (m._baseLayer) m.removeLayer(m._baseLayer);
    m._baseLayer = createMapboxLayer('mapbox/satellite-streets-v12').addTo(m); // in MAPBOX_STYLES
    // Zoom near max but ~3 ticks out → ~19
    const targetZoom = Math.min(typeof m.getMaxZoom === 'function' ? m.getMaxZoom() : 22, 19);
    m.flyTo([value.lat, value.lng], targetZoom, { duration: 0.8 });
  };

  const hasPin = value?.lat != null && value?.lng != null;

  return (
    <div className="space-y-2">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        {/* Drop pin toggle (iOS style) */}
        <div className="flex items-center gap-2">
          <span className="text-sm">Drop pin</span>
          <button
            type="button"
            role="switch"
            aria-checked={dropMode}
            onClick={() => setDropMode(v => !v)}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition
              ${dropMode ? 'bg-[var(--blue)]' : 'bg-[#2a2d30]'}`}
            title={dropMode ? 'Disable pin dropping' : 'Enable pin dropping'}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition
                ${dropMode ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* View close-up button */}
        <button
          type="button"
          onClick={handleViewCloseup}
          disabled={!hasPin}
          className={`px-3 py-2 rounded-lg ${
            hasPin ? 'btn-primary' : 'btn-ghost opacity-50 cursor-not-allowed'
          }`}
          title={hasPin ? 'Zoom to pin & switch to satellite' : 'Select an address or drop a pin first'}
        >
          View close‑up
        </button>

        {/* Style selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Map Style</label>
          <select
            className="text-sm px-2 py-1 rounded bg-[#0f1012] border border-[#2a2d30]"
            defaultValue="mapbox/navigation-night-v1"
            onChange={(e) => {
              const m = mapRef.current; if (!m) return;
              if (m._baseLayer) m.removeLayer(m._baseLayer);
              m._baseLayer = createMapboxLayer(e.target.value).addTo(m);
            }}
          >
            {Object.entries(MAPBOX_STYLES).map(([label, id]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <div id="address-preview-map" className="w-full h-80 lg:h-full min-h-80 rounded-lg" />
      <div className="text-xs">
        {dropMode ? 'Click the map to drop/move the pin.' : 'Pin dropping is OFF.'}
      </div>
    </div>
  );
}
