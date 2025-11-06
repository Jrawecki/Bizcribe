import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';
import 'leaflet/dist/leaflet.css';
import '../utils/mapIconSetup.js';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

import {
  MAPBOX_TOKEN,
  MAPBOX_DEFAULT_STYLE,
  MAPBOX_STYLES,
  MAPBOX_ENABLED,
  mapboxStyleUrl,
  osmTileProps,
} from '../utils/tiles.js';

mapboxgl.accessToken = MAPBOX_TOKEN || '';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const DEFAULT_ZOOM = 12;
const SEARCH_BUTTON_Z_INDEX = 1000;

const toBboxString = (bounds) => {
  if (!bounds) return '';
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  return `${west},${south},${east},${north}`;
};

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char] || char,
  );

const truncate = (value = '', maxLen = 160) => {
  if (!value) return '';
  return value.length > maxLen ? `${value.slice(0, maxLen - 3).trim()}...` : value;
};

const createPopupHtml = (biz) => {
  const name = escapeHtml(biz?.name || 'Untitled');
  const location = escapeHtml(biz?.location || '');
  const phone = biz?.phone_number ? escapeHtml(String(biz.phone_number)) : '';
  const description = truncate(escapeHtml(biz?.description || ''), 200);
  const detailsHref = biz?.id != null ? `/business/${biz.id}` : '';

  return `
    <div class="map-popup">
      <div class="map-popup__title">${name}</div>
      ${location ? `<div class="map-popup__row">${location}</div>` : ''}
      ${phone ? `<div class="map-popup__row">Phone: ${phone}</div>` : ''}
      ${description ? `<p class="map-popup__description">${description}</p>` : ''}
      ${
        detailsHref
          ? `<a class="map-popup__action map-popup__action--primary" href="${escapeHtml(detailsHref)}">View details</a>`
          : ''
      }
    </div>
  `;
};

export default function MapPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCenter, setUserCenter] = useState(null);
  const [styleId, setStyleId] = useState(MAPBOX_DEFAULT_STYLE);
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const [dirty, setDirty] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(0);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapTypeRef = useRef('mapbox');
  const markersRef = useRef([]);
  const clusterIndexRef = useRef(null);
  const geolocateRequestedRef = useRef(false);
  const lastAppliedStyleRef = useRef(null);
  const lastUserCenterRef = useRef(null);

  const isMapboxActive = MAPBOX_ENABLED && !mapboxFailed;

  const styleOptions = useMemo(() => Object.entries(MAPBOX_STYLES), []);

  const renderClusters = useCallback(() => {
    if (mapTypeRef.current !== 'mapbox') return;
    const map = mapRef.current;
    const index = clusterIndexRef.current;
    if (!map || !index) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const zoom = Math.round(map.getZoom());
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const clusters = index.getClusters(bbox, zoom);

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (feature.properties.cluster) {
        const pointCount = feature.properties.point_count;
        const clusterId = feature.properties.cluster_id;
        const size = 30 + Math.min(30, pointCount);
        const element = document.createElement('div');
        element.style.cssText =
          'background:#3b5f7c;color:#fff;border-radius:9999px;display:flex;align-items:center;justify-content:center;' +
          `width:${size}px;height:${size}px;border:2px solid rgba(255,255,255,.85);font-weight:600;font-size:13px;`;
        element.textContent = String(pointCount);
        element.addEventListener('click', () => {
          if (!clusterIndexRef.current || mapTypeRef.current !== 'mapbox') return;
          const expansionZoom = Math.min(clusterIndexRef.current.getClusterExpansionZoom(clusterId), 20);
          map.easeTo({ center: [lng, lat], zoom: expansionZoom, duration: 600 });
        });
        const marker = new mapboxgl.Marker({ element });
        marker.setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
        return;
      }

      const businessId = feature.properties.businessId;
      const biz = businesses.find((b) => b.id === businessId);
      if (!biz) return;

      const marker = new mapboxgl.Marker({ color: '#3b5f7c' }).setLngLat([lng, lat]);
      marker.setPopup(new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(createPopupHtml(biz)));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [businesses]);

  const loadForBounds = useCallback(
    async (bounds) => {
      if (!bounds) return;

      setLoading(true);
      setError('');
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
        let url = `/api/businesses/?bbox=${encodeURIComponent(bbox)}&limit=1000`;
        if (radiusMiles > 0 && mapRef.current && typeof mapRef.current.getCenter === 'function') {
          const center = mapRef.current.getCenter();
          if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
            const km = Math.round(radiusMiles * 1.60934 * 100) / 100;
            url = `/api/businesses/?near=${center.lat.toFixed(6)},${center.lng.toFixed(
              6,
            )}&radius_km=${km}&limit=1000`;
          }
        }

        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`Failed to load businesses (${res.status})`);
        const data = await res.json();
        setBusinesses(data);
        setError('');
      } catch (err) {
        const fallbackMessage = err instanceof Error ? err.message : 'Failed to load businesses';
        try {
          const fallback = await fetch('/api/businesses/?limit=100');
          if (fallback.ok) {
            setBusinesses(await fallback.json());
            setError('');
          } else {
            setError(fallbackMessage);
          }
        } catch {
          setError(fallbackMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [radiusMiles],
  );

  useEffect(() => {
    const points = (businesses || [])
      .filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number')
      .map((b) => ({
        type: 'Feature',
        properties: { cluster: false, businessId: b.id },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      }));
    clusterIndexRef.current = new Supercluster({ radius: 60, maxZoom: 20 }).load(points);
    renderClusters();
  }, [businesses, renderClusters]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const lat = parseFloat(params.get('lat') || '');
      const lng = parseFloat(params.get('lng') || '');
      const radius = parseFloat(params.get('radius') || '');
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setUserCenter({ lat, lng });
      }
      if (!Number.isNaN(radius)) {
        setRadiusMiles(radius);
      }
    } catch {
      // ignore malformed URLs
    }
  }, []);

  useEffect(() => {
    if (geolocateRequestedRef.current) return;
    if (!navigator.geolocation) return;
    geolocateRequestedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => {
    if (!isMapboxActive) return;
    if (!mapContainerRef.current) return;
    if (mapTypeRef.current === 'mapbox' && mapRef.current instanceof mapboxgl.Map) return;

    const startCenter = userCenter
      ? [userCenter.lng, userCenter.lat]
      : [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
    const startZoom = DEFAULT_ZOOM;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapboxStyleUrl(styleId),
        center: startCenter,
        zoom: startZoom,
        attributionControl: false,
      });

      mapTypeRef.current = 'mapbox';
      mapRef.current = map;
      lastAppliedStyleRef.current = styleId;

      const nav = new mapboxgl.NavigationControl({ showCompass: false });
      map.addControl(nav, 'bottom-right');

      const handleLoad = () => {
        map.resize();
        loadForBounds(map.getBounds());
        renderClusters();
      };
      const handleMoveEnd = () => {
        setDirty(true);
        renderClusters();
      };
      const handleError = (event) => {
        console.warn('Mapbox GL JS error', event?.error || event);
        setMapboxFailed(true);
      };

      map.on('load', handleLoad);
      map.on('moveend', handleMoveEnd);
      map.on('zoomend', renderClusters);
      map.on('error', handleError);

      return () => {
        map.off('load', handleLoad);
        map.off('moveend', handleMoveEnd);
        map.off('zoomend', renderClusters);
        map.off('error', handleError);
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        if (mapRef.current === map) {
          mapRef.current = null;
        }
        map.remove();
      };
    } catch (err) {
      console.warn('Unable to initialise Mapbox map', err);
      setMapboxFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapboxActive, loadForBounds, renderClusters]);

  useEffect(() => {
    if (mapTypeRef.current !== 'mapbox') return;
    const map = mapRef.current;
    if (!map) return;
    if (lastAppliedStyleRef.current === styleId) return;

    lastAppliedStyleRef.current = styleId;
    const nextStyle = mapboxStyleUrl(styleId);
    map.setStyle(nextStyle);
    map.once('styledata', () => {
      map.resize();
      renderClusters();
    });
  }, [styleId, renderClusters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getBounds !== 'function') return;
    loadForBounds(map.getBounds());
  }, [radiusMiles, loadForBounds]);

  useEffect(() => {
    if (!userCenter) return;
    const previous = lastUserCenterRef.current;
    if (previous && previous.lat === userCenter.lat && previous.lng === userCenter.lng) return;
    lastUserCenterRef.current = userCenter;

    const map = mapRef.current;
    if (!map) return;
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : DEFAULT_ZOOM;
    const targetZoom = Math.max(currentZoom, DEFAULT_ZOOM);

    if (mapTypeRef.current === 'mapbox') {
      map.jumpTo({
        center: [userCenter.lng, userCenter.lat],
        zoom: targetZoom,
      });
    } else if (typeof map.setView === 'function') {
      map.setView([userCenter.lat, userCenter.lng], targetZoom);
    }
  }, [userCenter]);

  useEffect(() => {
    if (!userCenter) return;
    const map = mapRef.current;
    if (!map || typeof map.getBounds !== 'function') return;
    loadForBounds(map.getBounds());
  }, [userCenter, loadForBounds]);

  useEffect(() => {
    if (!mapboxFailed) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (mapTypeRef.current === 'mapbox' && mapRef.current && typeof mapRef.current.remove === 'function') {
      try {
        mapRef.current.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }
    mapTypeRef.current = 'leaflet';
  }, [mapboxFailed]);

  const handleFallbackReady = useCallback(
    (leafletMap) => {
      mapTypeRef.current = 'leaflet';
      mapRef.current = leafletMap;
      if (userCenter) {
        leafletMap.setView([userCenter.lat, userCenter.lng], DEFAULT_ZOOM);
      }
      const bounds = leafletMap.getBounds?.();
      if (bounds) {
        loadForBounds(bounds);
      }
    },
    [loadForBounds, userCenter],
  );

  const handleFallbackMoveEnd = useCallback(() => {
    setDirty(true);
  }, []);

  const handleSearchThisArea = () => {
    const map = mapRef.current;
    if (!map || typeof map.getBounds !== 'function') return;
    loadForBounds(map.getBounds());
  };

  const handleBusinessFocus = (biz) => {
    if (!biz || typeof biz.lat !== 'number' || typeof biz.lng !== 'number') return;
    const map = mapRef.current;
    if (!map) return;

    if (mapTypeRef.current === 'mapbox') {
      const currentZoom = map.getZoom();
      map.flyTo({
        center: [biz.lng, biz.lat],
        zoom: Math.max(currentZoom, 16),
        duration: 700,
        essential: true,
      });
    } else if (typeof map.flyTo === 'function') {
      const currentZoom = map.getZoom();
      map.flyTo([biz.lat, biz.lng], Math.max(currentZoom, 16), { duration: 0.6 });
    }
  };

  const fallbackTileProps = useMemo(() => osmTileProps(), []);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            zIndex: SEARCH_BUTTON_Z_INDEX,
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="px-4 py-2 rounded-full panel">Loading map...</div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            zIndex: SEARCH_BUTTON_Z_INDEX,
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="px-4 py-2 rounded-full panel text-red-300">Error: {error}</div>
        </div>
      )}

      {dirty && (
        <div
          style={{
            position: 'absolute',
            zIndex: SEARCH_BUTTON_Z_INDEX,
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <button className="px-4 py-2 rounded-full btn-primary shadow" onClick={handleSearchThisArea}>
            Search this area
          </button>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          zIndex: SEARCH_BUTTON_Z_INDEX,
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
        <label htmlFor="radius" style={{ fontSize: 12, opacity: 0.8 }}>
          Distance filter
        </label>
        <select
          id="radius"
          value={radiusMiles}
          onChange={(ev) => setRadiusMiles(Number(ev.target.value))}
          style={{
            background: '#0f1012',
            color: 'white',
            border: '1px solid #2a2d30',
            borderRadius: 8,
            padding: '4px 8px',
          }}
        >
          <option value={0}>Current view</option>
          <option value={5}>Within 5 mi</option>
          <option value={10}>Within 10 mi</option>
          <option value={25}>Within 25 mi</option>
        </select>
      </div>

      {isMapboxActive && (
        <div
          style={{
            position: 'absolute',
            zIndex: SEARCH_BUTTON_Z_INDEX,
            top: 12,
            right: 12,
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '8px 10px',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 180,
            backdropFilter: 'blur(6px)',
          }}
        >
          <label htmlFor="style" style={{ fontSize: 12, opacity: 0.8 }}>
            Map style
          </label>
          <select
            id="style"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            style={{
              background: '#0f1012',
              color: 'white',
              border: '1px solid #2a2d30',
              borderRadius: 8,
              padding: '4px 8px',
            }}
          >
            {styleOptions.map(([label, value]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isMapboxActive && MAPBOX_ENABLED && (
        <div
          style={{
            position: 'absolute',
            zIndex: SEARCH_BUTTON_Z_INDEX,
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
          <span style={{ fontSize: 12, opacity: 0.85 }}>Mapbox unavailable - using OSM fallback</span>
          <button
            type="button"
            className="px-3 py-1 rounded-full btn-primary"
            onClick={() => setMapboxFailed(false)}
          >
            Retry
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0 }}>
        {isMapboxActive ? (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        ) : (
          <LeafletFallbackMap
            center={userCenter || WILMINGTON_CENTER}
            businesses={businesses}
            onReady={handleFallbackReady}
            onMoveEnd={handleFallbackMoveEnd}
            tileProps={fallbackTileProps}
          />
        )}
      </div>

      <aside
        className="hidden md:block"
        style={{ position: 'absolute', left: 12, top: 60, bottom: 12, width: 360, zIndex: SEARCH_BUTTON_Z_INDEX }}
      >
        <div className="panel rounded-xl h-full overflow-auto p-3">
          <h3 className="text-lg font-semibold mb-2">Businesses in view</h3>
          {loading ? (
            <div className="text-sm opacity-70">Loading...</div>
          ) : businesses.length === 0 ? (
            <div className="text-sm opacity-70">No businesses in this area.</div>
          ) : (
            <ul className="space-y-2">
              {businesses.slice(0, 100).map((b) => (
                <li
                  key={b.id}
                  className="p-2 rounded-lg hover:bg-[#101113] cursor-pointer"
                  onClick={() => handleBusinessFocus(b)}
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

function LeafletFallbackMap({ center, businesses, onReady, onMoveEnd, tileProps }) {
  const mapCenter = [center.lat, center.lng];

  return (
    <MapContainer
      center={mapCenter}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
    >
      <TileLayer {...tileProps} />
      <FallbackMapEvents onReady={onReady} onMoveEnd={onMoveEnd} />
      <LeafletClusterLayer items={businesses} />
    </MapContainer>
  );
}

function FallbackMapEvents({ onReady, onMoveEnd }) {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);

  useEffect(() => {
    if (!map || !onMoveEnd) return undefined;
    const handler = () => onMoveEnd(map);
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, onMoveEnd]);

  return null;
}

function LeafletClusterLayer({ items }) {
  const map = useMap();
  const [clusters, setClusters] = useState([]);
  const indexRef = useRef(null);

  useEffect(() => {
    const points = (items || [])
      .filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number')
      .map((b) => ({
        type: 'Feature',
        properties: { cluster: false, businessId: b.id },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      }));
    indexRef.current = new Supercluster({ radius: 60, maxZoom: 20 }).load(points);
    if (map && indexRef.current) {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      setClusters(indexRef.current.getClusters(bbox, zoom));
    } else {
      setClusters([]);
    }
  }, [items, map]);

  useEffect(() => {
    if (!map || !indexRef.current) return undefined;
    const update = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      setClusters(indexRef.current.getClusters(bbox, zoom));
    };
    map.on('moveend', update);
    map.on('zoomend', update);
    return () => {
      map.off('moveend', update);
      map.off('zoomend', update);
    };
  }, [map]);

  if (!clusters || clusters.length === 0) return null;

  return clusters.map((clusterFeature) => {
    const [lng, lat] = clusterFeature.geometry.coordinates;
    if (clusterFeature.properties.cluster) {
      const count = clusterFeature.properties.point_count;
      const clusterId = clusterFeature.properties.cluster_id;
      const size = 30 + Math.min(30, count);
      const icon = L.divIcon({
        html: `<div style="background:#3b5f7c;color:#fff;border-radius:9999px;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:2px solid rgba(255,255,255,.85);font-weight:600;">${count}</div>`,
        className: 'cluster-marker',
        iconSize: [size, size],
      });
      return (
        <Marker
          key={`cluster-${clusterId}`}
          position={[lat, lng]}
          icon={icon}
          eventHandlers={{
            click: () => {
              if (!map || !indexRef.current) return;
              const expansionZoom = Math.min(indexRef.current.getClusterExpansionZoom(clusterId), 20);
              map.setView([lat, lng], expansionZoom, { animate: true });
            },
          }}
        />
      );
    }

    const businessId = clusterFeature.properties.businessId;
    const biz = items.find((b) => b.id === businessId);
    if (!biz) return null;

    return (
      <Marker key={businessId} position={[lat, lng]}>
        <Popup>
          <div dangerouslySetInnerHTML={{ __html: createPopupHtml(biz) }} />
        </Popup>
      </Marker>
    );
  });
}
