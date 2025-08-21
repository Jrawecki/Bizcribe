import { useEffect, useRef } from 'react';
import L from 'leaflet';
import "../../utils/mapIconSetup.js"; // ensure default marker works
import { createMapboxLayer, MAPBOX_STYLES } from "../../utils/mapboxTiles.js";

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };

export default function MiniMap({ value, onChange }) {
  const mapRef = useRef(null);

  useEffect(() => {
    const m = L.map('address-preview-map', { center: [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng], zoom: 12, zoomControl: false });
    const base = createMapboxLayer('mapbox/navigation-night-v1').addTo(m);
    m._baseLayer = base;

    setTimeout(() => m.invalidateSize(), 200);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => m.setView([pos.coords.latitude, pos.coords.longitude], 12),
        () => {}, { enableHighAccuracy: true }
      );
    }

    let marker;
    const place = (lat, lng) => {
      if (marker) marker.remove();
      marker = L.marker([lat, lng]).addTo(m);
      m.setView([lat, lng], 15);
      onChange({ lat, lng });
    };

    m.on('click', (e) => place(e.latlng.lat, e.latlng.lng));

    if (value?.lat && value?.lng) place(value.lat, value.lng);

    mapRef.current = m;
    return () => { m.remove(); };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
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
      <div id="address-preview-map" className="w-full h-80 lg:h-full min-h-80 rounded-lg" />
      <div className="text-xs">Click the map to drop/move the pin.</div>
    </div>
  );
}
