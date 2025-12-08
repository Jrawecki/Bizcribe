import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { MapPin } from 'lucide-react';

const LUCIDE_PIN_HTML = renderToString(<MapPin size={28} strokeWidth={2.1} />);

import {
  MAPBOX_TOKEN,
  MAPBOX_DEFAULT_STYLE,
  MAPBOX_ENABLED,
  mapboxStyleUrl,
  osmTileProps,
} from '../utils/tiles.js';
import { fetchJsonWithTimeout } from '../utils/apiClient.js';

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
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const [dirty, setDirty] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(0);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapTypeRef = useRef('mapbox');
  const markersRef = useRef([]);
  const clusterIndexRef = useRef(null);
  const geolocateRequestedRef = useRef(false);
  const lastAppliedStyleRef = useRef(MAPBOX_DEFAULT_STYLE);
  const lastUserCenterRef = useRef(null);

  const styleId = MAPBOX_DEFAULT_STYLE;
  const isMapboxActive = MAPBOX_ENABLED && !mapboxFailed;

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
        const element = document.createElement('div');
        element.style.cssText =
          'display:flex;align-items:center;justify-content:center;position:relative;color:#fff;';
        element.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:#1f2937;border:2px solid rgba(255,255,255,0.9);box-shadow:0 4px 10px rgba(0,0,0,0.35);position:relative;">
            ${LUCIDE_PIN_HTML}
            <span style="position:absolute;bottom:4px;right:4px;background:#2563eb;color:#fff;border-radius:9999px;padding:2px 6px;font-size:11px;font-weight:700;line-height:1;">${pointCount}</span>
          </div>`;
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

      const el = document.createElement('div');
      el.style.cssText =
        'color:#2563eb;display:flex;align-items:center;justify-content:center;transform:translateY(-4px);';
      el.innerHTML = LUCIDE_PIN_HTML;
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]);
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

        const data = await fetchJsonWithTimeout(url);
        setBusinesses(data);
        setError('');
      } catch (err) {
        const fallbackMessage = err instanceof Error ? err.message : 'Failed to load businesses';
        try {
          const fallback = await fetchJsonWithTimeout('/api/businesses/?limit=100');
          setBusinesses(fallback);
          setError('');
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
    <div className="map-shell">
      <div className="map-canvas">
        <div className="map-overlay map-overlay--center">
          {loading && <div className="px-4 py-2 rounded-full panel">Loading map...</div>}
          {error && <div className="px-4 py-2 rounded-full panel text-red-300">Error: {error}</div>}
          {dirty && (
            <button className="px-4 py-2 rounded-full btn-primary shadow" onClick={handleSearchThisArea}>
              Search this area
            </button>
          )}
        </div>

        <div className="map-overlay map-overlay--left">
          <label htmlFor="radius" className="map-overlay__label">
            Distance filter
          </label>
          <select
            id="radius"
            value={radiusMiles}
            onChange={(ev) => setRadiusMiles(Number(ev.target.value))}
            className="map-overlay__select"
          >
            <option value={0}>Current view</option>
            <option value={5}>Within 5 mi</option>
            <option value={10}>Within 10 mi</option>
            <option value={25}>Within 25 mi</option>
          </select>
        </div>

        {!isMapboxActive && MAPBOX_ENABLED && (
          <div className="map-overlay map-overlay--right">
            <span className="map-overlay__text">Mapbox unavailable - using OSM fallback</span>
            <button
              type="button"
              className="px-3 py-1 rounded-full btn-primary"
              onClick={() => setMapboxFailed(false)}
            >
              Retry
            </button>
          </div>
        )}

        <div className="map-canvas__inner">
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
      </div>

      <aside className="map-list-panel hidden md:flex">
        <div className="panel rounded-xl h-full w-full flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--border)]">
            <h3 className="text-lg font-semibold">Businesses in view</h3>
          </div>
          <div className="p-3 flex-1 min-h-0 overflow-auto">
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
  const businessIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-lucide-marker',
        html: `<div style="color:#2563eb;display:flex;align-items:center;justify-content:center;width:32px;height:32px;transform:translateY(-4px);">${LUCIDE_PIN_HTML}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      }),
    [],
  );

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
      const icon = L.divIcon({
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:#1f2937;border:2px solid rgba(255,255,255,0.9);box-shadow:0 4px 10px rgba(0,0,0,0.35);">
            ${LUCIDE_PIN_HTML}
            <span style="position:absolute;bottom:4px;right:4px;background:#2563eb;color:#fff;border-radius:9999px;padding:2px 6px;font-size:11px;font-weight:700;line-height:1;">${count}</span>
          </div>`,
        className: 'cluster-marker',
        iconSize: [46, 46],
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
      <Marker key={businessId} position={[lat, lng]} icon={businessIcon}>
        <Popup>
          <div dangerouslySetInnerHTML={{ __html: createPopupHtml(biz) }} />
        </Popup>
      </Marker>
    );
  });
}
