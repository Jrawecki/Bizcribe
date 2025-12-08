import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MAPBOX_TOKEN,
  MAPBOX_ENABLED,
  MAPBOX_DEFAULT_STYLE,
  mapboxStyleUrl,
  osmTileProps,
} from '../../utils/tiles.js';
import { renderToString } from 'react-dom/server';
import { MapPin } from 'lucide-react';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const DEFAULT_STYLE = MAPBOX_DEFAULT_STYLE;
const SATELLITE_STYLE = 'mapbox/satellite-streets-v12';
const LUCIDE_PIN_HTML = renderToString(<MapPin size={28} strokeWidth={2.1} />);

mapboxgl.accessToken = MAPBOX_TOKEN || '';

const createMarkerEl = () => {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.className = 'mini-map__marker';
  el.style.color = '#2563eb';
  el.innerHTML = LUCIDE_PIN_HTML;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Selected location');
  return el;
};

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default function MiniMap({ value, onChange, pinEnabled = false }) {
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const closeupHandlerRef = useRef(() => {});

  const hasPin = value?.lat != null && value?.lng != null;
  const handleMapboxError = useCallback(() => {
    setMapboxFailed(true);
  }, []);
  const handleRetry = useCallback(() => {
    if (!MAPBOX_ENABLED) return;
    setMapboxFailed(false);
  }, []);
  const registerCloseup = useCallback((fn) => {
    closeupHandlerRef.current = typeof fn === 'function' ? fn : () => {};
  }, []);
  const handleCloseup = useCallback(() => {
    if (!hasPin) return;
    closeupHandlerRef.current?.();
  }, [hasPin]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleCloseup}
          disabled={!hasPin}
          className={`px-3 py-2 rounded-lg ${hasPin ? 'btn-primary' : 'btn-ghost opacity-50 cursor-not-allowed'}`}
          title={hasPin ? 'Zoom to pin (satellite if available)' : 'Select an address or drop a pin first'}
        >
          View close-up
        </button>
      </div>

      <div className="w-full h-80 lg:h-full min-h-80 rounded-lg overflow-hidden relative bg-[#0f1012] mini-map__canvas">
        {!mapboxFailed && MAPBOX_ENABLED ? (
          <MapboxMiniMap
            value={value}
            onChange={onChange}
            pinEnabled={pinEnabled}
            onError={handleMapboxError}
            registerCloseup={registerCloseup}
          />
        ) : (
          <LeafletMiniMap
            value={value}
            onChange={onChange}
            pinEnabled={pinEnabled}
            registerCloseup={registerCloseup}
          />
        )}

        {mapboxFailed && MAPBOX_ENABLED && (
          <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3 rounded-xl bg-black/65 backdrop-blur px-3 py-2 text-xs text-white/85">
            <span>Mapbox unavailable - showing fallback tiles.</span>
            <button type="button" onClick={handleRetry} className="btn btn-ghost text-xs px-2 py-1 rounded-lg pointer-events-auto">
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="text-xs">
        {pinEnabled
          ? 'Click the map to drop or move the pin.'
          : 'Select or search an address. If not found, enable manual mode to drop a pin.'}
      </div>
    </div>
  );
}

function MapboxMiniMap({ value, onChange, pinEnabled, onError, registerCloseup }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const dropModeRef = useRef(pinEnabled);
  const currentStyleRef = useRef(DEFAULT_STYLE);
  const loadTimeoutRef = useRef(null);
  const initialValueRef = useRef(value);
  const resizeHandlesRef = useRef({ rafs: [], timers: [] });

  const onChangeRef = useLatest(onChange);
  const onErrorRef = useLatest(onError);
  const valueRef = useLatest(value);

  useEffect(() => {
    dropModeRef.current = pinEnabled;
  }, [pinEnabled]);

const forceResizeSoon = useCallback(() => {
  const map = mapRef.current;
  if (!map) return;

  map.resize();
  if (typeof window === 'undefined') return;

  const handles = resizeHandlesRef.current;
  handles.rafs.forEach((id) => window.cancelAnimationFrame(id));
  handles.timers.forEach((id) => window.clearTimeout(id));
  handles.rafs = [];
  handles.timers = [];
  const rafId = window.requestAnimationFrame(() => {
    map.resize();
    window.dispatchEvent(new Event('resize'));
  });
  handles.rafs.push(rafId);

  handles.timers.push(
    window.setTimeout(() => {
      map.resize();
      window.dispatchEvent(new Event('resize'));
    }, 250),
  );
  handles.timers.push(
    window.setTimeout(() => {
      map.resize();
      window.dispatchEvent(new Event('resize'));
    }, 800),
  );
}, []);

  const placeMarker = useCallback(
    (lat, lng, { center = true, notify = true } = {}) => {
      const map = mapRef.current;
      if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (!markerRef.current) {
        const el = createMarkerEl();
        markerRef.current = el
          ? new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          : new mapboxgl.Marker({ color: '#3b5f7c' });
      }
      markerRef.current.setLngLat([lng, lat]).addTo(map);

      if (center) {
        const currentZoom = map.getZoom();
        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(currentZoom, 15),
          duration: 500,
          essential: true,
        });
      }

      if (notify) {
        onChangeRef.current?.({ lat, lng });
      }
    },
    [onChangeRef],
  );

  const initMap = useCallback(() => {
    if (!MAPBOX_ENABLED) return null;
    if (mapRef.current || !containerRef.current) return null;

    const initialValue = initialValueRef.current;
    const hasInitialPin =
      Number.isFinite(initialValue?.lat) && Number.isFinite(initialValue?.lng);
    const initialCenter = hasInitialPin
      ? [initialValue.lng, initialValue.lat]
      : [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
    const initialZoom = hasInitialPin ? 14 : 12;

    let resizeObserver;
    let resizeListener;

    try {
      if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
        throw new Error('Mapbox GL not supported in this browser');
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mapboxStyleUrl(DEFAULT_STYLE),
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: false,
      });

      mapRef.current = map;
      currentStyleRef.current = DEFAULT_STYLE;
      forceResizeSoon();

      // Zoom controls (minimal styling handled in CSS)
      const nav = new mapboxgl.NavigationControl({ showCompass: false });
      map.addControl(nav, 'bottom-right');

      const ensureResize = () => {
        map.resize();
      };

      if (typeof ResizeObserver === 'function' && containerRef.current) {
        resizeObserver = new ResizeObserver(ensureResize);
        resizeObserver.observe(containerRef.current);
      } else if (typeof window !== 'undefined') {
        resizeListener = ensureResize;
        window.addEventListener('resize', resizeListener);
      }

      const timeout =
        typeof window !== 'undefined'
          ? window.setTimeout(() => {
              if (!mapRef.current || mapRef.current !== map) return;
              if (!map.isStyleLoaded()) {
                onErrorRef.current?.();
              }
            }, 2500)
          : null;
      loadTimeoutRef.current = timeout;

      map.on('load', () => {
        if (loadTimeoutRef.current) {
          window.clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        map.resize();
        if (typeof window !== 'undefined') {
          window.setTimeout(() => map.resize(), 200);
        }
        forceResizeSoon();
        if (hasInitialPin) {
          placeMarker(initialValue.lat, initialValue.lng, { center: false, notify: false });
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.jumpTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: 12,
              });
            },
            () => {},
            { enableHighAccuracy: true },
          );
        }
      });

      map.on('error', (event) => {
        if (loadTimeoutRef.current) {
          window.clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        console.warn('MiniMap Mapbox error', event?.error || event);
        onErrorRef.current?.();
      });

      map.on('click', (event) => {
        if (!dropModeRef.current) return;
        placeMarker(event.lngLat.lat, event.lngLat.lng);
      });

      return () => {
        markerRef.current?.remove();
        markerRef.current = null;
        mapRef.current = null;
        currentStyleRef.current = DEFAULT_STYLE;
        if (loadTimeoutRef.current) {
          window.clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
        } else if (typeof window !== 'undefined' && resizeListener) {
          window.removeEventListener('resize', resizeListener);
        }
        if (typeof window !== 'undefined') {
          resizeHandlesRef.current.rafs.forEach((id) => window.cancelAnimationFrame(id));
          resizeHandlesRef.current.timers.forEach((id) => window.clearTimeout(id));
        }
        resizeHandlesRef.current = { rafs: [], timers: [] };
        map.remove();
      };
    } catch (err) {
      console.warn('Failed to initialise Mapbox mini map', err);
      onErrorRef.current?.();
      return null;
    }
  }, [forceResizeSoon, onErrorRef, placeMarker]);

  useEffect(() => {
    if (!MAPBOX_ENABLED) return undefined;
    let cleanup;
    let cancelled = false;
    let frameId = null;

    const ensureReady = () => {
      if (cancelled || cleanup || mapRef.current) return;
      if (!containerRef.current) {
        if (typeof window !== 'undefined') {
          frameId = window.requestAnimationFrame(ensureReady);
        }
        return;
      }
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) {
      if (typeof window !== 'undefined') {
        frameId = window.requestAnimationFrame(ensureReady);
      }
      return;
    }
    if (rect.height <= 0) {
      const parent = containerRef.current.parentElement;
      const parentHeight = parent?.getBoundingClientRect()?.height;
      if (parentHeight && Number.isFinite(parentHeight) && parentHeight > 0) {
        containerRef.current.style.height = `${parentHeight}px`;
      } else {
        containerRef.current.style.height = '320px';
      }
    }
    const result = initMap();
    if (result) {
      cleanup = result;
    }
    };

    ensureReady();

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
      cleanup?.();
    };
  }, [initMap]);

  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      placeMarker(value.lat, value.lng, { center: true, notify: false });
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value?.lat, value?.lng, placeMarker]);

  useEffect(() => {
    if (!registerCloseup) return () => {};
    const closeupHandler = () => {
      const target = valueRef.current;
      if (!mapRef.current || target?.lat == null || target?.lng == null) return;

      if (currentStyleRef.current !== SATELLITE_STYLE) {
        currentStyleRef.current = SATELLITE_STYLE;
        mapRef.current.setStyle(mapboxStyleUrl(SATELLITE_STYLE));
        mapRef.current.once('styledata', () => {
          markerRef.current?.addTo(mapRef.current);
          mapRef.current.flyTo({
            center: [target.lng, target.lat],
            zoom: Math.min(19, Math.max(mapRef.current.getZoom(), 18)),
            duration: 800,
            essential: true,
          });
          forceResizeSoon();
        });
      } else {
        mapRef.current.flyTo({
          center: [target.lng, target.lat],
          zoom: Math.min(19, Math.max(mapRef.current.getZoom(), 18)),
          duration: 800,
          essential: true,
        });
        forceResizeSoon();
      }
    };
    registerCloseup(closeupHandler);
    return () => registerCloseup(null);
  }, [forceResizeSoon, registerCloseup, valueRef]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function LeafletMiniMap({ value, onChange, pinEnabled, registerCloseup }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const dropModeRef = useRef(pinEnabled);
  const onChangeRef = useLatest(onChange);
  const valueRef = useLatest(value);
  const tileProps = useMemo(() => osmTileProps(), []);
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'mini-map__marker mini-map__marker--leaflet',
        html: `<div style="color:#2563eb;display:flex;align-items:center;justify-content:center;width:32px;height:32px;transform:translateY(-4px);">${LUCIDE_PIN_HTML}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      }),
    [],
  );

  useEffect(() => {
    dropModeRef.current = pinEnabled;
  }, [pinEnabled]);

  const place = useCallback(
    (lat, lng, { center = true, notify = true } = {}) => {
      const map = mapRef.current;
      if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
      }
      if (center) {
        map.panTo([lat, lng]);
      }
      if (notify) {
        onChangeRef.current?.({ lat, lng });
      }
    },
    [markerIcon, onChangeRef],
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer(tileProps.url, tileProps).addTo(map);
    mapRef.current = map;

    const initialValue = valueRef.current;
    if (initialValue?.lat != null && initialValue?.lng != null) {
      place(initialValue.lat, initialValue.lng, { center: true, notify: false });
    }

    const ensureSize = () => {
      map.invalidateSize();
    };
    ensureSize();
    const resizeTimer =
      typeof window !== 'undefined' ? window.setTimeout(ensureSize, 200) : null;

    let resizeObserver;
    if (typeof ResizeObserver === 'function' && containerRef.current) {
      resizeObserver = new ResizeObserver(ensureSize);
      resizeObserver.observe(containerRef.current);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', ensureSize);
    }

    if (navigator.geolocation && (initialValue?.lat == null || initialValue?.lng == null)) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 12),
        () => {},
        { enableHighAccuracy: true },
      );
    }

    const handleClick = (event) => {
      if (!dropModeRef.current) return;
      place(event.latlng.lat, event.latlng.lng);
    };
    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', ensureSize);
      }
      if (resizeTimer != null && typeof window !== 'undefined') {
        window.clearTimeout(resizeTimer);
      }
    };
  }, [place, tileProps, valueRef]);

  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      place(value.lat, value.lng, { center: true, notify: false });
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value?.lat, value?.lng, place]);

  useEffect(() => {
    if (!registerCloseup) return () => {};
    const closeupHandler = () => {
      const target = valueRef.current;
      if (!mapRef.current || target?.lat == null || target?.lng == null) return;
      const targetZoom = Math.min(mapRef.current.getMaxZoom?.() || 21, 19);
      mapRef.current.flyTo([target.lat, target.lng], targetZoom, { duration: 0.8 });
    };
    registerCloseup(closeupHandler);
    return () => registerCloseup(null);
  }, [registerCloseup, valueRef]);

  return <div ref={containerRef} className="w-full h-full" />;
}
