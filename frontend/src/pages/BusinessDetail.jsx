import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { mapboxTileProps, osmTileProps, MAPBOX_TOKEN, MAPBOX_DEFAULT_STYLE } from '../utils/tiles.js';

export default function BusinessDetail() {
  const { id } = useParams();
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [useFallbackTiles, setUseFallbackTiles] = useState(!MAPBOX_TOKEN);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        if (mounted) setBiz(data);
      } catch (e) {
        if (mounted) setError('Business not found');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const tileProps = useMemo(() => useFallbackTiles ? osmTileProps() : mapboxTileProps(MAPBOX_DEFAULT_STYLE), [useFallbackTiles]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error || !biz) return <div className="p-6">{error || 'Error'}</div>;

  const position = (typeof biz.lat === 'number' && typeof biz.lng === 'number') ? [biz.lat, biz.lng] : null;
  const directionsUrl = position
    ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.address1 || biz.name)}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/" className="underline">← Back</Link>
      <h1 className="text-3xl font-bold mt-2">{biz.name}</h1>
      <div className="opacity-80 mt-1">{biz.location}</div>
      {biz.phone_number && <div className="mt-1">📞 {biz.phone_number}</div>}
      {biz.description && <p className="mt-4">{biz.description}</p>}

      <div className="mt-6 rounded-xl overflow-hidden" style={{ height: 360 }}>
        <MapContainer center={position || [39.7391, -75.5398]} zoom={position ? 15 : 12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url={tileProps.url}
            attribution={tileProps.attribution}
            tileSize={tileProps.tileSize}
            zoomOffset={tileProps.zoomOffset}
            detectRetina={tileProps.detectRetina}
            maxZoom={tileProps.maxZoom}
            eventHandlers={{ tileerror: () => setUseFallbackTiles(true) }}
          />
          {position && (
            <Marker position={position}>
              <Popup>{biz.name}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="mt-4">
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full btn-primary">Directions</a>
      </div>
    </div>
  );
}

