import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import '../mapIconSetup.js';

export default function MapPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <p className="text-center mt-8">Loading map…</p>;
  if (error)   return <p className="text-center mt-8 text-red-500">Error: {error}</p>;

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <MapContainer
        center={[40.7128, -74.0060]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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