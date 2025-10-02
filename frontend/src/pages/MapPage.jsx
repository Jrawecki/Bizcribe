import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../utils/mapIconSetup.js';

// Fallback center (Wilmington, DE)
const WILMINGTON_CENTER = [39.7391, -75.5398];

// Mapbox preset styles (add your Studio style if you want)
const MAPBOX_STYLES = {
  'Neon Night (Mapbox)': 'mapbox/navigation-night-v1',
  'Streets': 'mapbox/streets-v12',
  'Outdoors': 'mapbox/outdoors-v12',
  'Clean Light': 'mapbox/light-v11',
  'Modern Dark': 'mapbox/dark-v11',
  'Satellite Streets': 'mapbox/satellite-streets-v12',
};

// Ensure styles/v1/ prefix
const normalizeStylePath = (styleId) =>
  styleId.startsWith('styles/v1/') ? styleId : `styles/v1/${styleId}`;

// Build tile URL
const mapboxUrl = (styleId, token) =>
  `https://api.mapbox.com/${normalizeStylePath(styleId)}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function GeolocateOnce({ onLocate }) {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 13);
        onLocate?.([latitude, longitude]);
      },
      () => {
        // silently ignore (fallback stays)
      },
      { enableHighAccuracy: true }
    );

    return () => { cancelled = true; };
  }, [map, onLocate]);

  return null;
}

export default function MapPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [styleId, setStyleId] = useState('mapbox/navigation-night-v1');
  const [userCenter, setUserCenter] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/businesses');
        if (!res.ok) throw new Error('Failed to load businesses');
        setBusinesses(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const tileUrl = useMemo(() => {
    if (!MAPBOX_TOKEN) {
      console.error('VITE_MAPBOX_TOKEN is missing. Put it in frontend/.env and restart Vite.');
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // fallback
    }
    return mapboxUrl(styleId, MAPBOX_TOKEN);
  }, [styleId]);

  if (loading) return <p className="text-center mt-8">Loading map...</p>;
  if (error)   return <p className="text-center mt-8 text-red-500">Error: {error}</p>;

  return (
    <div style={{ height: "100vh", width: "100vw", position: 'relative' }}>
      {/* Style switcher overlay */}
      <div
        style={{
          position: 'absolute',
          zIndex: 1000,
          top: 12,
          right: 12,
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '8px 10px',
          borderRadius: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          backdropFilter: 'blur(6px)',
        }}
      >
        <label htmlFor="style" style={{ fontSize: 12, opacity: 0.8 }}>Map Style</label>
        <select
          id="style"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          style={{
            background: '#0f1012',
            color: 'white',
            border: '1px solid #2a2d30',
            borderRadius: 8,
            padding: '6px 8px',
          }}
        >
          {Object.entries(MAPBOX_STYLES).map(([label, id]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <MapContainer
        center={userCenter || WILMINGTON_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url={tileUrl}
          attribution={
            MAPBOX_TOKEN
              ? '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
              : '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          }
          tileSize={512}
          zoomOffset={-1}
          detectRetina={true}
          maxZoom={22}
        />

        {/* Center to user location on first render (like the mini map) */}
        <GeolocateOnce onLocate={setUserCenter} />

        {businesses
          .filter(biz => typeof biz.lat === 'number' && typeof biz.lng === 'number')
          .map(biz => (
            <Marker key={biz.id} position={[biz.lat, biz.lng]}>
              <Popup>
                <h3 className="font-bold text-lg">{biz.name}</h3>
                <p className="text-sm mb-2">{biz.description}</p>
                <p className="text-sm"><strong>Phone:</strong> {biz.phone_number}</p>
                <p className="text-sm"><strong>Location:</strong> {biz.location}</p>
              </Popup>
            </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
