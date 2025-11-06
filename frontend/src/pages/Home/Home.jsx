import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'leaflet/dist/leaflet.css';
import {
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  PersonStanding,
  Phone,
  Search,
  SlidersHorizontal,
  ZoomIn,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker as LeafletMarker, Popup as LeafletPopup, TileLayer } from 'react-leaflet';
import { useAddressSearch } from './hooks/useAddressSearch.js';
import pinDropUrl from '../../assets/pin_drop.png';
import {
  MAPBOX_TOKEN,
  MAPBOX_DEFAULT_STYLE,
  MAPBOX_ENABLED,
  osmTileProps,
  mapboxStyleUrl,
} from '../../utils/tiles.js';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const DEFAULT_ZOOM = 12;
const DARK_STYLE = 'mapbox/navigation-night-v1';
const SATELLITE_STYLE = 'mapbox/satellite-streets-v12';
const MARKER_ICON_URL = pinDropUrl;

mapboxgl.accessToken = MAPBOX_TOKEN || '';

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const hasCoordinates = (point) => !!point && isFiniteNumber(point.lat) && isFiniteNumber(point.lng);

const toLngLatTuple = (point) => (hasCoordinates(point) ? [point.lng, point.lat] : null);

const toLeafletTuple = (point) => (hasCoordinates(point) ? [point.lat, point.lng] : null);

const createMarkerElement = (title = 'Location pin') => {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.className = 'home-map__marker';
  el.style.backgroundImage = `url(${pinDropUrl})`;
  el.setAttribute('aria-label', title);
  el.setAttribute('role', 'img');
  return el;
};

const defer = (fn) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
  } else {
    Promise.resolve().then(fn);
  }
};

const scheduleRootUnmount = (root) => {
  if (!root) return;
  defer(() => {
    try {
      root.unmount();
    } catch (err) {
      console.error('Failed to unmount React root', err);
    }
  });
};

const toKm = (mi) => Math.round(mi * 1.60934 * 100) / 100;

const isValidPoint = (point) =>
  !!point &&
  typeof point.lat === 'number' && Number.isFinite(point.lat) &&
  typeof point.lng === 'number' && Number.isFinite(point.lng);

const haversineMi = (a, b) => {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return (R * c) / 1.60934;
};

const formatAddress = (biz) =>
  biz.location ||
  [biz.address1, biz.city, biz.state].filter(Boolean).join(', ');

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);

const buildDirectionsUrl = (biz) => {
  if (typeof biz.lat === 'number' && typeof biz.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.name || '')}`;
};

const buildCallHref = (biz) => {
  if (!biz.phone_number) return null;
  const digits = String(biz.phone_number).replace(/[^\d+]/g, '');
  if (!digits) return null;
  return `tel:${digits}`;
};

const buildPopupData = (biz, center) => {
  const distance = haversineMi(center, biz);
  const distanceLabel = typeof distance === 'number' && Number.isFinite(distance)
    ? `${distance.toFixed(1)} mi`
    : '';
  const description = (biz.description || '').trim();
  const truncatedDescription = description.length > 160
    ? `${description.slice(0, 157).trim()}...`
    : description;
  const phone = biz.phone_number ? String(biz.phone_number).trim() : '';
  return {
    name: biz.name || 'Untitled',
    address: formatAddress(biz) || '',
    description: truncatedDescription,
    distanceLabel,
    phone,
    callHref: buildCallHref(biz),
    directionsHref: buildDirectionsUrl(biz),
    detailHref: biz?.id != null ? `/business/${biz.id}` : '',
  };
};

function MapPopupContent({ info, onCloseup }) {
  const detailRows = [];
  if (info.address) {
    detailRows.push(
      <div key="address" className="map-popup__row">
        <span className="map-popup__icon">
          <MapPin size={16} strokeWidth={1.8} />
        </span>
        <span>{info.address}</span>
      </div>,
    );
  }
  if (info.phone) {
    detailRows.push(
      <div key="phone" className="map-popup__row">
        <span className="map-popup__icon">
          <Phone size={16} strokeWidth={1.8} />
        </span>
        {info.callHref ? (
          <a className="map-popup__link" href={info.callHref}>
            {info.phone}
          </a>
        ) : (
          <span>{info.phone}</span>
        )}
      </div>,
    );
  }

  const actions = [
    info.detailHref ? (
      <a key="view" className="map-popup__action" href={info.detailHref}>
        <ExternalLink size={16} strokeWidth={1.8} />
        <span>View</span>
      </a>
    ) : null,
    info.callHref ? (
      <a key="call" className="map-popup__action" href={info.callHref}>
        <Phone size={16} strokeWidth={1.8} />
        <span>Call</span>
      </a>
    ) : null,
    (
      <a
        key="directions"
        className="map-popup__action map-popup__action--primary map-popup__action--directions"
        href={info.directionsHref}
        target="_blank"
        rel="noreferrer"
      >
        <Navigation size={16} strokeWidth={1.8} />
        <span>Directions</span>
      </a>
    ),
    (
      <button
        key="closeup"
        type="button"
        className="map-popup__action map-popup__action--focus"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCloseup?.();
        }}
      >
        <ZoomIn size={16} strokeWidth={1.8} />
        <span>View close-up</span>
      </button>
    ),
  ].filter(Boolean);

  return (
    <div className="map-popup map-popup--business">
      <div className="map-popup__header">
        <div className="map-popup__title-stack">
          {info.detailHref ? (
            <a className="map-popup__title map-popup__title-link" href={info.detailHref}>
              {info.name}
            </a>
          ) : (
            <div className="map-popup__title">{info.name}</div>
          )}
        </div>
        {info.distanceLabel ? <span className="map-popup__pill">{info.distanceLabel}</span> : null}
      </div>

      {info.description ? <p className="map-popup__desc">{info.description}</p> : null}
      {detailRows.length ? <div className="map-popup__details">{detailRows}</div> : null}

      {actions.length ? <div className="map-popup__actions">{actions}</div> : null}
    </div>
  );
}

function createPopupElement(info, onCloseup) {
  if (typeof document === 'undefined') {
    return { element: null, unmount: () => {} };
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  root.render(<MapPopupContent info={info} onCloseup={onCloseup} />);
  return {
    element: container,
    unmount: () => {
      scheduleRootUnmount(root);
    },
  };
}

export default function Home() {
  const [what, setWhat] = useState('');
  const [radiusMi, setRadiusMi] = useState(5);
  const [center, setCenter] = useState(null); // {lat,lng}
  const [centerLabel, setCenterLabel] = useState('your location');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationPanelRect, setLocationPanelRect] = useState(null);
  const [filtersPanelRect, setFiltersPanelRect] = useState(null);
  const [focusedBusinessId, setFocusedBusinessId] = useState(null);
  const [mapStyle, setMapStyle] = useState(MAPBOX_DEFAULT_STYLE);
  const [mapSupportsStyles, setMapSupportsStyles] = useState(MAPBOX_ENABLED);

  const addr = useAddressSearch();
  const centerLockedRef = useRef(false);
  const locationRef = useRef(null);
  const filtersRef = useRef(null);
  const mapSectionRef = useRef(null);

  const locationSuggestions = (addr.state.list || []).slice(0, 10);

  useEffect(() => {
    const savedWhat = localStorage.getItem('home_what');
    const savedRadius = localStorage.getItem('home_radius');
    if (savedWhat != null) setWhat(savedWhat);
    if (savedRadius != null) setRadiusMi(Number(savedRadius) || 5);
    let cancelled = false;
    (async () => {
      if (!navigator?.geolocation) return;
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (cancelled) return;
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (cancelled) return;
                if (!centerLockedRef.current && !center) {
                  setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setCenterLabel('your location');
                  addr.state.setQuery('Current location', { keepLocked: true });
                }
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
            );
          }
        }
      } catch (error) {
        console.debug('Geolocation permission query failed', error);
      }
    })();
    return () => { cancelled = true; };
  }, [center]);

  useEffect(() => {
    const handler = (event) => {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setLocationOpen(false);
        addr.state.setOpen(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateLocationPanelRect = useCallback(() => {
    if (!locationRef.current) return;
    const rect = locationRef.current.getBoundingClientRect();
    setLocationPanelRect({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const updateFiltersPanelRect = useCallback(() => {
    if (!filtersRef.current) return;
    const rect = filtersRef.current.getBoundingClientRect();
    setFiltersPanelRect({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 220),
    });
  }, []);

  useEffect(() => {
    if (!locationOpen || typeof window === 'undefined') return undefined;
    updateLocationPanelRect();
    const handler = () => updateLocationPanelRect();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [locationOpen, updateLocationPanelRect]);

  useEffect(() => {
    if (!locationOpen) setLocationPanelRect(null);
  }, [locationOpen]);

  useEffect(() => {
    if (locationOpen) updateLocationPanelRect();
  }, [locationOpen, locationSuggestions.length, updateLocationPanelRect]);

  useEffect(() => {
    if (!filtersOpen || typeof window === 'undefined') return undefined;
    updateFiltersPanelRect();
    const handler = () => updateFiltersPanelRect();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [filtersOpen, updateFiltersPanelRect]);

  useEffect(() => {
    if (!filtersOpen) setFiltersPanelRect(null);
  }, [filtersOpen]);

  useEffect(() => {
    if (filtersOpen) updateFiltersPanelRect();
  }, [filtersOpen, radiusMi, updateFiltersPanelRect]);


  const runSearch = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/businesses/', window.location.origin);
      url.searchParams.set('near', `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`);
      url.searchParams.set('radius_km', String(toKm(radiusMi)));
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to load nearby businesses');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Search failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [center, radiusMi]);

  useEffect(() => { localStorage.setItem('home_what', what || ''); }, [what]);
  useEffect(() => { localStorage.setItem('home_radius', String(radiusMi)); }, [radiusMi]);
  useEffect(() => { if (center) runSearch(); }, [center, radiusMi, runSearch]);

  const filtered = useMemo(() => {
    if (!what.trim()) return items;
    const q = what.toLowerCase();
    return items.filter((b) => (
      [(b.name || ''), (b.description || ''), (b.location || ''), (b.city || ''), (b.state || ''), (b.zip || '')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    ));
  }, [items, what]);

  const focusBusiness = useMemo(
    () => filtered.find((b) => b.id === focusedBusinessId) || null,
    [filtered, focusedBusinessId],
  );

  useEffect(() => {
    if (focusedBusinessId == null) return;
    if (!filtered.some((b) => b.id === focusedBusinessId)) {
      setFocusedBusinessId(null);
    }
  }, [filtered, focusedBusinessId]);

  const handleFocusBusiness = useCallback((biz) => {
    if (!biz || typeof biz.lat !== 'number' || typeof biz.lng !== 'number') return;
    setFocusedBusinessId(biz.id);
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleCloseupRequest = useCallback((biz) => {
    if (!biz || typeof biz.lat !== 'number' || typeof biz.lng !== 'number') return;
    setMapStyle((prev) => (prev === SATELLITE_STYLE ? prev : SATELLITE_STYLE));
    handleFocusBusiness(biz);
  }, [handleFocusBusiness, setMapStyle]);


  const canUsePortal = typeof document !== 'undefined';

  const locationDropdown = canUsePortal && locationOpen && locationPanelRect
    ? createPortal(
        <div
          className="dropdown-panel dropdown-panel--overlay"
          style={{ top: locationPanelRect.top, left: locationPanelRect.left, width: locationPanelRect.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="dropdown-item dropdown-item--action"
            onClick={() => {
              if (!navigator?.geolocation) return;
              const previousQuery = addr.state.query;
              addr.state.setQuery('Current location', { keepLocked: true });
              addr.actions.lock();
              addr.state.setOpen(false);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  centerLockedRef.current = true;
                  setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setCenterLabel('your location');
                  setLocationOpen(false);
                  addr.state.setOpen(false);
                  addr.state.setQuery('Current location', { keepLocked: true });
                },
                () => {
                  addr.state.setQuery(previousQuery || '', { keepLocked: true });
                  addr.actions.unlock();
                },
                { enableHighAccuracy: true }
              );
            }}
          >
            Use current location
          </button>
          <div className="dropdown-scroll">
            {addr.state.fetching && <div className="dropdown-empty">Searching...</div>}
            {!addr.state.fetching && locationSuggestions.length === 0 && (
              <div className="dropdown-empty">No matches yet. Try a city or ZIP.</div>
            )}
            {locationSuggestions.map((s, idx) => (
              <button
                key={`${s.label}-${idx}`}
                type="button"
                className="dropdown-item"
                onClick={() => {
                  if (s.lat != null && s.lng != null) {
                    centerLockedRef.current = true;
                    setCenter({ lat: s.lat, lng: s.lng });
                  }
                  addr.state.setQuery(s.label || '', { keepLocked: true });
                  addr.actions.lock();
                  setCenterLabel(s.label || 'chosen address');
                  setLocationOpen(false);
                  addr.state.setOpen(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  const filtersDropdown = canUsePortal && filtersOpen && filtersPanelRect
    ? createPortal(
        <div
          className="dropdown-panel dropdown-panel--overlay dropdown-panel--filters"
          style={{ top: filtersPanelRect.top, left: filtersPanelRect.left, width: filtersPanelRect.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="dropdown-group">
            <div className="dropdown-label">Radius</div>
            <div className="dropdown-value">{radiusMi} mi</div>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={radiusMi}
            onChange={(e) => setRadiusMi(Number(e.target.value))}
            className="dropdown-range"
          />
          <div className="dropdown-range-scale">
            <span>1 mi</span>
            <span>50 mi</span>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <main className="flex-1 flex flex-col">
        <section className="flex-1 pt-8 pb-16 lg:pt-10 lg:pb-20 px-2 sm:px-4 lg:px-6">
          <div className="w-full flex flex-col gap-8 lg:gap-10">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)]/92 backdrop-blur-xl shadow-2xl px-5 py-5 md:px-7 md:py-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[220px] max-w-3xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    value={what}
                    onChange={(e) => setWhat(e.target.value)}
                    type="text"
                    placeholder="Search by name, product, or area..."
                    className="w-full h-11 rounded-2xl bg-[var(--bg-alt)] border border-[var(--border)] pl-12 pr-4 text-base focus:outline-none focus:border-[var(--ceramic)] focus:ring-0"
                  />
                </div>

                <div className={`relative flex-1 min-w-[220px] max-w-md ${locationOpen ? 'z-50' : ''}`} ref={locationRef}>
                  <div className="relative">
                    <LocateFixed className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={18} />
                    <input
                      type="text"
                      value={addr.state.query}
                      onFocus={() => {
                        setLocationOpen(true);
                        addr.actions.unlock();
                        if (addr.state.query) {
                          addr.state.setQuery('');
                        }
                        addr.state.setOpen(true);
                        setTimeout(updateLocationPanelRect, 0);
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        addr.state.setQuery(value);
                        addr.actions.unlock();
                        if (value && value.trim().length >= 2) {
                          addr.state.setOpen(true);
                          addr.actions.search(value);
                        } else {
                          addr.state.setOpen(false);
                        }
                      }}
                      placeholder="Location"
                      className="w-full h-11 rounded-2xl bg-[var(--bg-alt)] border border-[var(--border)] pl-12 pr-4 text-base focus:outline-none focus:border-[var(--ceramic)] focus:ring-0"
                    />
                  </div>
                </div>

                <div className={`relative ${filtersOpen ? 'z-50' : ''}`} ref={filtersRef}>
                  <button
                    type="button"
                    className={`text-trigger ${filtersOpen ? 'text-[var(--ceramic)]' : ''}`}
                    onClick={() =>
                      setFiltersOpen((open) => {
                        const next = !open;
                        if (!open && next) {
                          setTimeout(updateFiltersPanelRect, 0);
                        }
                        return next;
                      })
                    }
                    aria-haspopup="true"
                    aria-expanded={filtersOpen}
                  >
                    <SlidersHorizontal size={18} />
                    <span className="text-base">Filters</span>
                  </button>
                </div>
              </div>

              <div className="text-sm text-white/70 text-center md:text-left mt-3">
                {center
                  ? `Showing ${filtered.length} result${filtered.length === 1 ? '' : 's'} within ${radiusMi} mi of ${centerLabel}.`
                  : 'Choose a location to see nearby businesses.'}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] flex-1 min-h-[520px] lg:min-h-[620px] items-start">
              <div
                ref={mapSectionRef}
                className="rounded-3xl border border-[var(--border)] bg-[var(--bg-alt)]/70 relative overflow-hidden h-[55vh] md:h-[60vh] lg:h-[min(62vh,calc(100vh-150px))] lg:sticky lg:top-[96px] z-0"
              >
                <ResultsMap
                  center={center}
                  items={filtered}
                  focusBusiness={focusBusiness}
                  mapStyle={mapStyle}
                  onMapboxStatusChange={setMapSupportsStyles}
                  onCloseup={handleCloseupRequest}
                />
                {mapSupportsStyles && (
                  <div className="absolute top-4 right-4 z-20">
                    <label htmlFor="home-map-style" className="sr-only">
                      Map style
                    </label>
                    <select
                      id="home-map-style"
                      value={mapStyle}
                      onChange={(event) => setMapStyle(event.target.value)}
                      className="bg-[var(--bg-panel)]/90 border border-[var(--border)] text-sm rounded-xl px-3 py-2 text-white/90 focus:outline-none focus:ring-2 focus:ring-[var(--ceramic)]"
                    >
                      <option value={MAPBOX_DEFAULT_STYLE}>Streets</option>
                      <option value={DARK_STYLE}>Neon Night</option>
                      <option value={SATELLITE_STYLE}>Satellite Streets</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)]/92 backdrop-blur-lg shadow-2xl p-5 flex flex-col h-full relative z-10">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Nearby businesses</h2>
                </header>

                {error && <div className="text-red-400 mb-3">{error}</div>}

                {loading ? (
                  <ul className="space-y-3 flex-1">
                    {[...Array(4)].map((_, idx) => (
                      <li key={idx} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 animate-pulse space-y-3">
                        <div className="h-4 w-2/3 bg-white/10 rounded" />
                        <div className="h-3 w-1/2 bg-white/8 rounded" />
                        <div className="h-3 w-4/5 bg-white/6 rounded" />
                      </li>
                    ))}
                  </ul>
                ) : !center ? (
                  <div className="flex-1 flex items-center justify-center text-white/60 text-sm text-center px-2">
                    Pick a location to discover small businesses around you.
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-white/60 text-sm text-center px-2">
                    No results matched your filters. Try widening the radius or adjusting your search.
                  </div>
                ) : (
                  <ul className="space-y-4 overflow-y-auto pr-1 flex-1" role="list">
                    {filtered.map((biz) => {
                      const isFocused = focusedBusinessId === biz.id;
                      const distance = haversineMi(center, biz);
                      const dLabel = typeof distance === 'number' && Number.isFinite(distance)
                        ? `${distance.toFixed(1)} mi`
                        : '';
                      const directions = (typeof biz.lat === 'number' && typeof biz.lng === 'number')
                        ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.name)}`;
                      const canFocus = typeof biz.lat === 'number' && typeof biz.lng === 'number';
                      return (
                        <li
                          key={biz.id}
                          className={`rounded-2xl border border-white/6 bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-4 ${
                            isFocused ? 'border-[var(--ceramic)] bg-white/[0.08]' : ''
                          }`}
                          onClick={() => {
                            if (canFocus) handleFocusBusiness(biz);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                to={`/business/${biz.id}`}
                                className="text-lg font-semibold underline decoration-transparent hover:decoration-inherit"
                              >
                                {biz.name}
                              </Link>
                              <div className="mt-1 text-sm text-white/60 flex items-center gap-2">
                                <MapPin size={14} className="text-white/40 shrink-0" />
                                <span className="truncate">{formatAddress(biz)}</span>
                              </div>
                              {biz.description && (
                                <p className="mt-2 text-sm text-white/70 line-clamp-2">
                                  {biz.description}
                                </p>
                              )}
                            </div>
                            {dLabel && (
                              <span className="chip text-xs px-2 py-0.5 shrink-0">
                                {dLabel}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex items-center gap-3 flex-wrap">
                            {biz.phone_number && (
                              <a
                                href={`tel:${biz.phone_number}`}
                                className="btn btn-ghost text-sm rounded-xl px-3 py-2"
                              >
                                <Phone size={16} />
                                Call
                              </a>
                            )}
                            <a
                              href={directions}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary text-sm rounded-xl px-3 py-2"
                            >
                              Directions
                            </a>
                            {canFocus && (
                              <button
                                type="button"
                                className="btn btn-ghost text-sm rounded-xl px-3 py-2"
                                onClick={() => handleFocusBusiness(biz)}
                              >
                                <MapPin size={16} />
                                View on map
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-r from-[var(--bg-panel)]/95 via-[var(--bg-alt)] to-[var(--bg-panel)]/95 px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
              <div className="text-center md:text-left">
                <h3 className="text-xl font-semibold text-white">
                  Own a small business? Get featured on Bizscribe.
                </h3>
                <p className="text-sm text-white/70 mt-1">
                  Share your story and help locals discover what makes your spot special.
                </p>
              </div>
              <Link to="/register-business" className="btn btn-primary rounded-2xl px-6 py-3 text-base font-semibold">
                Add Your Business
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-[var(--border)] py-5 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 text-center text-sm text-white/60">
            &copy; {new Date().getFullYear()} Bizscribe &middot; Map data &copy; OpenStreetMap contributors & Mapbox
          </div>
        </footer>
      </main>
    </div>
    {locationDropdown}
    {filtersDropdown}
    </>
  );
}

function ResultsMap({ center, items, focusBusiness, mapStyle = MAPBOX_DEFAULT_STYLE, onMapboxStatusChange, onCloseup }) {
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const youMarkerRef = useRef(null);
  const youMarkerRootRef = useRef(null);
  const activePopupRef = useRef(null);
  const centerRef = useRef(center);
  const lastStyleRef = useRef(mapStyle);
  const pendingCloseupRef = useRef(false);

  useEffect(() => { centerRef.current = center; }, [center]);

  const removeYouMarker = useCallback(() => {
    if (youMarkerRef.current) {
      youMarkerRef.current.remove();
      youMarkerRef.current = null;
    }
    if (youMarkerRootRef.current) {
      const root = youMarkerRootRef.current;
      youMarkerRootRef.current = null;
      scheduleRootUnmount(root);
    }
  }, []);

  const focusOnBusiness = useCallback(() => {
    if (!focusBusiness || mapboxFailed || !mapRef.current) return;
    if (pendingCloseupRef.current && mapStyle !== SATELLITE_STYLE) return;
    const coords = toLngLatTuple(focusBusiness);
    if (!coords) return;
    const [lng, lat] = coords;
    const { id } = focusBusiness;
    const map = mapRef.current;
    const closeupRequested = pendingCloseupRef.current;
    const targetZoom = closeupRequested
      ? Math.min(19, Math.max(map.getZoom(), 18))
      : Math.max(map.getZoom(), 16);

    const showPopup = (markerInstance) => {
      if (!markerInstance || typeof markerInstance.getPopup !== 'function') return;
      const popup = markerInstance.getPopup();
      if (!popup) return;
      popup.setLngLat([lng, lat]);
      if (typeof popup.isOpen === 'function') {
        if (!popup.isOpen()) markerInstance.togglePopup();
      } else {
        markerInstance.togglePopup();
      }
    };

    map.flyTo({
      center: [lng, lat],
      zoom: targetZoom,
      duration: 700,
      essential: true,
    });

    map.once('moveend', () => {
      pendingCloseupRef.current = false;
      if (id == null) return;
      if (activePopupRef.current) {
        if (typeof activePopupRef.current.__unmount === 'function') {
          activePopupRef.current.__unmount();
          activePopupRef.current.__unmount = null;
        }
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
      const refreshed = markersRef.current.get(id);
      if (refreshed) {
        showPopup(refreshed);
      } else {
        const info = buildPopupData(focusBusiness, centerRef.current || center);
        const { element, unmount } = createPopupElement(info, () => {
          pendingCloseupRef.current = true;
          onCloseup?.(focusBusiness);
        });
        const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setLngLat([lng, lat]).addTo(map);
        if (element) {
          popup.setDOMContent(element);
        }
        popup.__unmount = unmount;
        popup.on('close', () => {
          if (typeof popup.__unmount === 'function') {
            popup.__unmount();
            popup.__unmount = null;
          }
        });
        activePopupRef.current = popup;
      }
    });

    if (id != null) {
      const marker = markersRef.current.get(id);
      if (marker) {
        if (
          activePopupRef.current &&
          activePopupRef.current !== (typeof marker.getPopup === 'function' ? marker.getPopup() : null)
        ) {
          if (typeof activePopupRef.current.__unmount === 'function') {
            activePopupRef.current.__unmount();
            activePopupRef.current.__unmount = null;
          }
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }
        showPopup(marker);
      }
    }
  }, [focusBusiness, mapboxFailed, center, mapStyle]);

  const rebuildMarkers = useCallback(() => {
    if (mapboxFailed || !mapRef.current) return;
    markersRef.current.forEach((marker) => {
      if (typeof marker.getPopup === 'function') {
        const popup = marker.getPopup();
        if (popup && typeof popup.__unmount === 'function') {
          popup.__unmount();
          popup.__unmount = null;
        }
      }
      marker.remove();
    });
    markersRef.current.clear();
    if (activePopupRef.current) {
      if (typeof activePopupRef.current.__unmount === 'function') {
        activePopupRef.current.__unmount();
        activePopupRef.current.__unmount = null;
      }
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    (items || []).forEach((biz) => {
      if (typeof biz.lng !== 'number' || typeof biz.lat !== 'number') return;
      const element = createMarkerElement(biz.name || 'Business location');
      const marker =
        element != null
          ? new mapboxgl.Marker({ element, anchor: 'bottom' })
          : new mapboxgl.Marker({ color: '#3b5f7c' });

      marker.setLngLat([biz.lng, biz.lat]);

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false });
      popup.on('open', () => {
        const info = buildPopupData(biz, centerRef.current || center);
        const { element, unmount } = createPopupElement(info, () => {
          pendingCloseupRef.current = true;
          onCloseup?.(biz);
        });
        if (element) {
          popup.setDOMContent(element);
        }
        popup.__unmount = unmount;
        activePopupRef.current = popup;
      });
      popup.on('close', () => {
        if (typeof popup.__unmount === 'function') {
          popup.__unmount();
          popup.__unmount = null;
        }
      });
      marker.setPopup(popup);
      marker.addTo(mapRef.current);
      if (biz?.id != null) {
        markersRef.current.set(biz.id, marker);
      }
    });

    focusOnBusiness();
  }, [items, mapboxFailed, center, focusOnBusiness, onCloseup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapboxFailed) {
      removeYouMarker();
      return;
    }
    const coords = toLngLatTuple(center);
    if (!coords) {
      removeYouMarker();
      return;
    }
    if (!youMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'home-map__you-marker';
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', 'Your location');
      element.title = 'You are here';
      element.style.zIndex = '60';
      element.style.pointerEvents = 'none';
      const root = createRoot(element);
      root.render(<PersonStanding size={52} strokeWidth={2.4} color="#166534" />);
      youMarkerRootRef.current = root;
      const marker = new mapboxgl.Marker({ element, anchor: 'center' });
      marker.setLngLat(coords).addTo(map);
      youMarkerRef.current = marker;
      return;
    }
    youMarkerRef.current.setLngLat(coords);
  }, [center, mapboxFailed, removeYouMarker]);

  useEffect(() => {
    onMapboxStatusChange?.(!mapboxFailed);
  }, [mapboxFailed, onMapboxStatusChange]);

  useEffect(() => {
    if (mapRef.current || mapboxFailed) return;
    if (!containerRef.current) return;
    const preferredCenter = toLngLatTuple(centerRef.current) || toLngLatTuple(center);
    const startingCenter = preferredCenter || [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mapboxStyleUrl(mapStyle),
        center: startingCenter,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        map.resize();
      });
      map.on('error', () => {
        setMapboxFailed(true);
      });
    } catch (error) {
      console.warn('Mapbox map failed to initialise', error);
      setMapboxFailed(true);
    }

    return () => {
      markersRef.current.forEach((marker) => {
        if (typeof marker.getPopup === 'function') {
          const popup = marker.getPopup();
          if (popup && typeof popup.__unmount === 'function') {
            popup.__unmount();
            popup.__unmount = null;
          }
        }
        marker.remove();
      });
      markersRef.current.clear();
      if (activePopupRef.current) {
        if (typeof activePopupRef.current.__unmount === 'function') {
          activePopupRef.current.__unmount();
          activePopupRef.current.__unmount = null;
        }
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
      removeYouMarker();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxFailed, mapStyle, removeYouMarker]);

  useEffect(() => {
    if (mapboxFailed || !mapRef.current) return;
    const coords = toLngLatTuple(center);
    if (!coords) return;
    mapRef.current.jumpTo({ center: coords, zoom: DEFAULT_ZOOM });
  }, [center, mapboxFailed]);

  useEffect(() => {
    if (mapboxFailed || !mapRef.current || typeof window === 'undefined') return;
    const handleResize = () => {
      mapRef.current?.resize();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapboxFailed]);

  useEffect(() => {
    if (mapboxFailed && activePopupRef.current) {
      if (typeof activePopupRef.current.__unmount === 'function') {
        activePopupRef.current.__unmount();
        activePopupRef.current.__unmount = null;
      }
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }
  }, [mapboxFailed]);

  useEffect(() => {
    rebuildMarkers();
  }, [rebuildMarkers]);

  useEffect(() => {
    focusOnBusiness();
  }, [focusOnBusiness]);

  useEffect(() => {
    if (mapboxFailed || !mapRef.current) return;
    if (lastStyleRef.current === mapStyle) return;
    const map = mapRef.current;
    lastStyleRef.current = mapStyle;
    map.setStyle(mapboxStyleUrl(mapStyle));
    map.once('styledata', () => {
      map.resize();
      rebuildMarkers();
      focusOnBusiness();
    });
  }, [mapStyle, mapboxFailed, rebuildMarkers, focusOnBusiness]);

  useEffect(() => {
    if (!focusBusiness && activePopupRef.current) {
      if (typeof activePopupRef.current.__unmount === 'function') {
        activePopupRef.current.__unmount();
        activePopupRef.current.__unmount = null;
      }
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }
  }, [focusBusiness]);

  useEffect(() => {
    if (!focusBusiness) {
      pendingCloseupRef.current = false;
    }
  }, [focusBusiness]);

  if (mapboxFailed || !MAPBOX_ENABLED) {
    return (
      <div className="absolute inset-0">
        <LeafletFallback center={center} items={items} focusBusiness={focusBusiness} onCloseup={onCloseup} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

function LeafletFallback({ center, items, focusBusiness, onCloseup }) {
  const tileProps = osmTileProps();
  const mapCenter = center ? [center.lat, center.lng] : [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng];
  const zoom = center ? DEFAULT_ZOOM : 4;
  const mapRef = useRef(null);
  const pendingCloseupRef = useRef(false);
  const markerIcon = useMemo(
    () =>
      L.icon({
        iconUrl: MARKER_ICON_URL,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -30],
        className: 'home-map__marker home-map__marker--leaflet',
      }),
    [],
  );
  const youIcon = useMemo(
    () =>
      L.divIcon({
        className: 'home-map__you-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      }),
    [],
  );

  const handleLeafletCloseup = useCallback(
    (biz) => {
      pendingCloseupRef.current = true;
      onCloseup?.(biz);
      const map = mapRef.current;
      const coords = toLeafletTuple(biz);
      if (map && coords) {
        const targetZoom = Math.min(map.getMaxZoom?.() || 21, 19);
        map.flyTo(coords, targetZoom, { duration: 0.6 });
      }
    },
    [onCloseup],
  );

  useEffect(() => {
    return () => {
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!focusBusiness) {
      pendingCloseupRef.current = false;
    }
  }, [focusBusiness]);

  useEffect(() => {
    if (!mapRef.current || !focusBusiness) return;
    const leafletCoords = toLeafletTuple(focusBusiness);
    if (!leafletCoords) return;
    const [lat, lng] = leafletCoords;
    const map = mapRef.current;
    const currentZoom = map.getZoom?.() ?? DEFAULT_ZOOM;
    const closeupRequested = pendingCloseupRef.current;
    const targetZoom = closeupRequested
      ? Math.min(map.getMaxZoom?.() || 21, Math.max(currentZoom, 18))
      : Math.max(currentZoom, 16);
    map.flyTo(leafletCoords, targetZoom, { duration: 0.6 });
    const info = buildPopupData(focusBusiness, center);
    const { element, unmount } = createPopupElement(info, () => handleLeafletCloseup(focusBusiness));
    const popup = L.popup({ offset: [0, -12] }).setLatLng(leafletCoords);
    if (element) {
      popup.setContent(element);
    }
    popup.openOn(map);
    popup.once('remove', () => {
      unmount();
    });
    pendingCloseupRef.current = false;
  }, [focusBusiness, center, handleLeafletCloseup]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      scrollWheelZoom
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
      whenCreated={(map) => {
        mapRef.current = map;
      }}
    >
      <TileLayer {...tileProps} />
      {typeof center?.lat === 'number' && typeof center?.lng === 'number' && (
        <LeafletMarker
          position={[center.lat, center.lng]}
          icon={youIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={1000}
          eventHandlers={{
            add: (event) => {
              const el = event.target.getElement();
                if (el && !el.__root) {
                const root = createRoot(el);
                root.render(<PersonStanding size={52} strokeWidth={2.4} color="#166534" />);
                el.__root = root;
              }
            },
            remove: (event) => {
              const el = event.target.getElement();
              if (el && el.__root) {
                const root = el.__root;
                el.__root = null;
                scheduleRootUnmount(root);
              }
            },
          }}
        />
      )}
      {(items || []).map((biz, idx) => {
        if (typeof biz.lng !== 'number' || typeof biz.lat !== 'number') return null;
        const info = buildPopupData(biz, center);
        return (
          <LeafletMarker key={biz.id ?? idx} position={[biz.lat, biz.lng]} icon={markerIcon}>
            <LeafletPopup>
              <MapPopupContent info={info} onCloseup={() => handleLeafletCloseup(biz)} />
            </LeafletPopup>
          </LeafletMarker>
        );
      })}
    </MapContainer>
  );
}










