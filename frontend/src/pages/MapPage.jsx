import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../utils/mapIconSetup.js';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { mapboxTileProps, osmTileProps, MAPBOX_TOKEN, MAPBOX_DEFAULT_STYLE, MAPBOX_STYLES } from '../utils/tiles.js';

// Fallback center (Wilmington, DE)
const WILMINGTON_CENTER = [39.7391, -75.5398];

const toBboxString = (bounds) => {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  const west = southWest.lng;
  const south = southWest.lat;
  const east = northEast.lng;
  const north = northEast.lat;
  return `${west},${south},${east},${north}`;
};

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
      () => {},
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
  const [userCenter, setUserCenter] = useState(null);
  const [useFallbackTiles, setUseFallbackTiles] = useState(!MAPBOX_TOKEN);
  const [styleId, setStyleId] = useState(MAPBOX_DEFAULT_STYLE);
  const mapRef = useRef(null);
  const [dirty, setDirty] = useState(false); // map moved since last search
  const [radiusMiles, setRadiusMiles] = useState(0); // 0 = use viewport bbox

  // Hydrate initial center and radius from URL params (if provided)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const lat = sp.get('lat');
      const lng = sp.get('lng');
      const r = sp.get('radius');
      if (lat && lng) {
        const la = Number(lat), ln = Number(lng);
        if (!Number.isNaN(la) && !Number.isNaN(ln)) setUserCenter([la, ln]);
      }
      if (r && !Number.isNaN(Number(r))) setRadiusMiles(Number(r));
    } catch {}
  }, []);

  const loadForBounds = useCallback(async (bounds) => {
    setLoading(true);
    setError(null);
    setDirty(false);

    const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    };

    try {
      const bbox = toBboxString(bounds);
      let url;
      if (radiusMiles > 0 && mapRef.current) {
        const c = mapRef.current.getCenter();
        const km = Math.round(radiusMiles * 1.60934 * 100) / 100;
        url = `/api/businesses/?near=${c.lat.toFixed(6)},${c.lng.toFixed(6)}&radius_km=${km}&limit=1000`;
      } else {
        url = `/api/businesses/?bbox=${encodeURIComponent(bbox)}&limit=1000`;
      }
      let res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Failed to load businesses (${res.status})`);
      const data = await res.json();
      setBusinesses(data);
    } catch (err) {
      // Fallback: try without bbox to verify backend connectivity
      try {
        const fallback = await fetch(`/api/businesses/?limit=100`);
        if (fallback.ok) {
          setBusinesses(await fallback.json());
          setError('');
        } else {
          setError(err.message || 'Failed to load businesses');
        }
      } catch {
        setError(err.message || 'Failed to load businesses');
      }
    } finally {
      setLoading(false);
    }
  }, [radiusMiles]);

  // After map is ready, load for current bounds and watch moves
  const onMapReady = useCallback((map) => {
    mapRef.current = map;
    loadForBounds(map.getBounds());
    map.on('moveend', () => setDirty(true));
  }, [loadForBounds]);

  // After geolocation recenters, auto search this area
  useEffect(() => {
    if (mapRef.current && userCenter) {
      loadForBounds(mapRef.current.getBounds());
    }
  }, [userCenter, loadForBounds]);

  // Re-query when radius changes
  useEffect(() => {
    if (mapRef.current) {
      loadForBounds(mapRef.current.getBounds());
    }
  }, [radiusMiles, loadForBounds]);

  const tileProps = useMemo(() => {
    return useFallbackTiles ? osmTileProps() : mapboxTileProps(styleId);
  }, [useFallbackTiles, styleId]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', zIndex: 1000, top: 12, left: '50%', transform: 'translateX(-50%)' }}>
          <div className="px-4 py-2 rounded-full panel">Loading map...</div>
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', zIndex: 1000, top: 12, left: '50%', transform: 'translateX(-50%)' }}>
          <div className="px-4 py-2 rounded-full panel text-red-300">Error: {error}</div>
        </div>
      )}
      {/* Search this area overlay */}
      {dirty && (
        <div style={{ position: 'absolute', zIndex: 1000, top: 12, left: '50%', transform: 'translateX(-50%)' }}>
          <button
            className="px-4 py-2 rounded-full btn-primary shadow"
            onClick={() => mapRef.current && loadForBounds(mapRef.current.getBounds())}
          >
            Search this area
          </button>
        </div>
      )}

      {/* Distance filter */}
      <div
        style={{
          position: 'absolute',
          zIndex: 1000,
          top: 12,
          left: 12,
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
        <label htmlFor="radius" style={{ fontSize: 12, opacity: 0.8 }}>Distance</label>
        <select
          id="radius"
          value={radiusMiles}
          onChange={(e) => setRadiusMiles(Number(e.target.value))}
          style={{
            background: '#0f1012',
            color: 'white',
            border: '1px solid #2a2d30',
            borderRadius: 8,
            padding: '6px 8px',
          }}
        >
          <option value={0}>In view</option>
          <option value={1}>Within 1 mi</option>
          <option value={3}>Within 3 mi</option>
          <option value={5}>Within 5 mi</option>
          <option value={10}>Within 10 mi</option>
          <option value={25}>Within 25 mi</option>
        </select>
      </div>

      {/* Map style selector (Mapbox only) */}
      {!useFallbackTiles && (
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
      )}

      <MapContainer
        center={userCenter || WILMINGTON_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <MapCreated onReady={onMapReady} />
        <TileLayer
          url={tileProps.url}
          attribution={tileProps.attribution}
          tileSize={tileProps.tileSize}
          zoomOffset={tileProps.zoomOffset}
          detectRetina={tileProps.detectRetina}
          maxZoom={tileProps.maxZoom}
          eventHandlers={{ tileerror: () => setUseFallbackTiles(true) }}
        />

        {/* Center to user location on first render (like the mini map) */}
        <GeolocateOnce onLocate={setUserCenter} />

        <ClusteredMarkers items={businesses} mapRef={mapRef} />
      </MapContainer>

      {/* Sidebar list */}
      <aside
        className="hidden md:block"
        style={{ position: 'absolute', left: 12, top: 60, bottom: 12, width: 360, zIndex: 900 }}
      >
        <div className="panel rounded-xl h-full overflow-auto p-3">
          <h3 className="text-lg font-semibold mb-2">Businesses in view</h3>
          {loading ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : businesses.length === 0 ? (
            <div className="text-sm opacity-70">No businesses in this area.</div>
          ) : (
            <ul className="space-y-2">
              {businesses.slice(0, 100).map((b) => (
                <li key={b.id} className="p-2 rounded-lg hover:bg-[#101113] cursor-pointer"
                    onClick={() => {
                      if (mapRef.current && typeof b.lat === 'number' && typeof b.lng === 'number') {
                        mapRef.current.flyTo([b.lat, b.lng], Math.max(mapRef.current.getZoom(), 16), { duration: 0.6 });
                      }
                    }}
                >
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs opacity-80">{b.location}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function MapCreated({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (map) onReady(map);
  }, [map, onReady]);
  return null;
}

function ClusteredMarkers({ items, mapRef }) {
  const [clusters, setClusters] = useState([]);
  const indexRef = useRef(null);

  // Build or update supercluster index when items change
  useEffect(() => {
    const points = (items || []).filter(b => typeof b.lat === 'number' && typeof b.lng === 'number').map(b => ({
      type: 'Feature',
      properties: { cluster: false, businessId: b.id, name: b.name },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    }));
    indexRef.current = new Supercluster({ radius: 60, maxZoom: 20 }).load(points);
    // Trigger recompute for current bounds
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      const zoom = mapRef.current.getZoom();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      setClusters(indexRef.current.getClusters(bbox, zoom));
    } else {
      setClusters([]);
    }
  }, [items, mapRef]);

  // Recalculate clusters on map move/zoom
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    const update = () => {
      if (!indexRef.current) return;
      const b = m.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const z = m.getZoom();
      setClusters(indexRef.current.getClusters(bbox, z));
    };
    m.on('moveend', update);
    m.on('zoomend', update);
    return () => { m.off('moveend', update); m.off('zoomend', update); };
  }, [mapRef]);

  if (!clusters || clusters.length === 0) return null;

  return clusters.map((c) => {
    const [lng, lat] = c.geometry.coordinates;
    const { cluster, point_count: pointCount, cluster_id } = c.properties;
    if (cluster) {
      const size = 30 + Math.min(30, pointCount);
      const icon = L.divIcon({
        html: `<div style="background:#3b5f7c;color:#fff;border-radius:9999px;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:2px solid rgba(255,255,255,.85)">${pointCount}</div>`,
        className: 'cluster-marker', iconSize: [size, size]
      });
      return (
        <Marker key={`cluster-${cluster_id}`} position={[lat, lng]} icon={icon} eventHandlers={{
          click: () => {
            if (!mapRef.current || !indexRef.current) return;
            const expansionZoom = Math.min(indexRef.current.getClusterExpansionZoom(cluster_id), 20);
            mapRef.current.setView([lat, lng], expansionZoom, { animate: true });
          }
        }} />
      );
    }
    const id = c.properties.businessId;
    const item = items.find(b => b.id === id);
    if (!item) return null;
    return (
      <Marker key={id} position={[lat, lng]}>
        <Popup>
          <h3 className="font-bold text-lg">{item.name}</h3>
          <p className="text-sm mb-2">{item.description}</p>
          <p className="text-sm"><strong>Phone:</strong> {item.phone_number}</p>
          <p className="text-sm"><strong>Location:</strong> {item.location}</p>
          <a href={`/business/${id}`} className="underline">View details</a>
        </Popup>
      </Marker>
    );
  });
}


