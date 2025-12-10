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
  MapPinHouse,
  Phone,
  Search,
  SlidersHorizontal,
  Disc2,
  ZoomIn,
  Circle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAddressSearch } from './hooks/useAddressSearch.js';
import {
  MAPBOX_TOKEN,
  MAPBOX_DEFAULT_STYLE,
  MAPBOX_ENABLED,
  osmTileProps,
  mapboxStyleUrl,
} from '../../utils/tiles.js';
import { fetchJsonWithTimeout } from '../../utils/apiClient.js';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const DEFAULT_ZOOM = 12;

mapboxgl.accessToken = MAPBOX_TOKEN || '';

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const hasCoordinates = (point) => !!point && isFiniteNumber(point.lat) && isFiniteNumber(point.lng);

const toLngLatTuple = (point) => (hasCoordinates(point) ? [point.lng, point.lat] : null);

const toLeafletTuple = (point) => (hasCoordinates(point) ? [point.lat, point.lng] : null);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const HOME_MIN_ZOOM = 7;
const MARKER_HIDE_ZOOM = 8;
const markerScaleForZoom = (zoom = DEFAULT_ZOOM) =>
  clamp(0.48 + ((zoom - MARKER_HIDE_ZOOM) * 0.08), 0.48, 0.92);

const createMarkerElement = (title = 'Location pin', variant = 'business', countLabel = '') => {
  if (typeof document === 'undefined') return null;
  const el = document.createElement(variant === 'business' ? 'button' : 'div');
  if (variant === 'business') {
    el.type = 'button';
  }
  el.className = `map-marker-icon map-marker-icon--${variant}`;
  el.setAttribute('aria-label', title);
  if (variant !== 'business') {
    el.setAttribute('role', 'img');
  }
  el.style.setProperty('--marker-scale', '1');
  el.style.pointerEvents = variant === 'business' ? 'auto' : 'none';
  const root = createRoot(el);
  if (variant === 'cluster') {
    root.render(
      <div className="map-marker-cluster__inner">
        <Circle className="map-marker-cluster__svg" size={28} strokeWidth={1.8} fill="none" />
        <span className="map-marker-cluster__count">{countLabel}</span>
      </div>,
    );
  } else {
    const Icon = variant === 'you' ? MapPinHouse : MapPin;
    const size = variant === 'you' ? 30 : 28;
    root.render(
      <Icon
        className={`map-marker-icon__svg ${variant === 'you' ? 'map-marker-icon__svg--you' : ''}`}
        size={size}
        strokeWidth={variant === 'you' ? 2.3 : 2.1}
      />,
    );
  }
  el.__markerRoot = root;
  el.__markerVariant = variant;
  return el;
};

const cleanupMarkerElement = (marker) => {
  if (!marker || typeof marker.getElement !== 'function') return;
  const el = marker.getElement();
  if (el && el.__markerRoot) {
    scheduleRootUnmount(el.__markerRoot);
    el.__markerRoot = null;
  }
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

const formatAddress = (biz) => {
  if (biz.hide_address) return 'Address hidden';
  return biz.location || [biz.address1, biz.city, biz.state].filter(Boolean).join(', ');
};

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
    address: biz.hide_address ? '' : (formatAddress(biz) || ''),
    description: truncatedDescription,
    distanceLabel,
    phone,
    callHref: buildCallHref(biz),
    directionsHref: biz.hide_address ? '' : buildDirectionsUrl(biz),
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
        {info.directionsHref ? (
          <a
            className="map-popup__link"
            href={info.directionsHref}
            target="_blank"
            rel="noreferrer"
          >
            {info.address}
          </a>
        ) : (
          <span>{info.address}</span>
        )}
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
        <span>Details</span>
      </a>
    ) : null,
    (
      <button
        key="closeup"
        type="button"
        className="map-popup__action map-popup__action--ghost"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCloseup?.();
        }}
      >
        <ZoomIn size={16} strokeWidth={1.8} />
        <span>Zoom map</span>
      </button>
    ),
  ].filter(Boolean);

  return (
    <div className="map-popup">
      <div className="map-popup__header">
        <div className="map-popup__title-stack">
          {info.detailHref ? (
            <a className="map-popup__title map-popup__title-link" href={info.detailHref}>
              {info.name}
            </a>
          ) : (
            <div className="map-popup__title">{info.name}</div>
          )}
          {info.address && <div className="map-popup__subtitle">{info.address}</div>}
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
  const [center, setCenter] = useState(WILMINGTON_CENTER); // {lat,lng}
  const [centerLabel, setCenterLabel] = useState('Wilmington, DE');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationPanelRect, setLocationPanelRect] = useState(null);
  const [filtersPanelRect, setFiltersPanelRect] = useState(null);
  const [focusedBusinessId, setFocusedBusinessId] = useState(null);
  const [activeBiz, setActiveBiz] = useState(null);
  const mapStyle = MAPBOX_DEFAULT_STYLE;

  const {
    state: {
      query: addrQuery,
      setQuery: setAddrQuery,
      setOpen: setAddrOpen,
      fetching: addrFetching,
      list: addrList,
    },
    actions: { search: searchAddress, lock: lockAddressInput, unlock: unlockAddressInput },
  } = useAddressSearch();
  const centerLockedRef = useRef(false);
  const restoreActiveRef = useRef(null);
  const locationRefDesktop = useRef(null);
  const locationRefMobile = useRef(null);
  const filtersRefDesktop = useRef(null);
  const filtersRefMobile = useRef(null);
  const mapSectionRef = useRef(null);
  const locationDropdownPressRef = useRef(false);
  const currentLocationRequestRef = useRef(false);
  const prevLocationValueRef = useRef('');

  const locationSuggestions = (addrList || []).slice(0, 10);

  const applyCurrentLocation = useCallback(
    (options = {}) => {
      if (!navigator?.geolocation) return;
      const { skipIfLocked = false } = options;
      if (skipIfLocked && centerLockedRef.current) return;
      const previousQuery = addrQuery;
      currentLocationRequestRef.current = true;
      setAddrQuery('Current location', { keepLocked: true });
      lockAddressInput();
      setAddrOpen(false);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          centerLockedRef.current = true;
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setCenterLabel('Current location');
          setLocationOpen(false);
          setAddrOpen(false);
          setAddrQuery('Current location', { keepLocked: true });
          currentLocationRequestRef.current = false;
        },
        () => {
          centerLockedRef.current = false;
          setAddrQuery(previousQuery || '', { keepLocked: true });
          unlockAddressInput();
          currentLocationRequestRef.current = false;
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 },
      );
    },
    [addrQuery, lockAddressInput, setAddrOpen, setAddrQuery, setCenter, setCenterLabel, setLocationOpen, unlockAddressInput],
  );

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
                if (!centerLockedRef.current) {
                  setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setCenterLabel('Current location');
                  setAddrQuery('Current location', { keepLocked: true });
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
  }, [setAddrQuery]);

  useEffect(() => {
    const handler = (event) => {
      const filterAnchors = [filtersRefDesktop.current, filtersRefMobile.current].filter(Boolean);
      const clickedInsideFilters = filterAnchors.some((el) => el.contains(event.target));
      if (!clickedInsideFilters) setFiltersOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setAddrOpen]);

  const getVisibleLocationRect = useCallback(() => {
    const anchors = [locationRefDesktop.current, locationRefMobile.current].filter(Boolean);
    const visible = anchors.find((el) => el && el.offsetParent !== null) || anchors[0];
    if (!visible) return null;
    const rect = visible.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
    const margin = 12;
    const maxWidth = vw - margin * 2;
    const width = Math.min(Math.max(rect.width, 220), maxWidth);
    let left = rect.left;
    if (left + width > vw - margin) {
      left = vw - margin - width;
    }
    left = Math.max(margin, left);
    const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
    const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
    return {
      top: rect.bottom + 8 + scrollY,
      left: left + scrollX,
      width,
    };
  }, []);

  const updateLocationPanelRect = useCallback(() => {
    const rect = getVisibleLocationRect();
    if (rect) setLocationPanelRect(rect);
  }, [getVisibleLocationRect]);

  const updateFiltersPanelRect = useCallback(() => {
    const anchors = [filtersRefDesktop.current, filtersRefMobile.current].filter(Boolean);
    const visible = anchors.find((el) => el && el.offsetParent !== null) || anchors[0];
    if (!visible) return;
    const rect = visible.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
    const margin = 12;
    const maxWidth = vw - margin * 2;
    const width = Math.min(Math.max(rect.width, 220), maxWidth);
    let left = rect.left;
    if (left + width > vw - margin) {
      left = vw - margin - width;
    }
    left = Math.max(margin, left);
    setFiltersPanelRect({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, []);

  const handleLocationFocus = useCallback(() => {
    prevLocationValueRef.current = addrQuery || centerLabel || '';
    setLocationOpen(true);
    unlockAddressInput();
    setAddrQuery('');
    setAddrOpen(true);
    setTimeout(updateLocationPanelRect, 0);
  }, [addrQuery, centerLabel, setAddrOpen, setAddrQuery, unlockAddressInput, updateLocationPanelRect]);

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
    if ((!filtersOpen && !locationOpen) || typeof window === 'undefined') return undefined;
    return undefined;
  }, [filtersOpen, locationOpen]);

  useEffect(() => {
    if ((!filtersOpen && !locationOpen) || typeof document === 'undefined') return undefined;
    const handleOutsideInteraction = (event) => {
      const target = event.target;
      const anchorEls = [
        filtersRefDesktop.current,
        filtersRefMobile.current,
        locationRefDesktop.current,
        locationRefMobile.current,
      ].filter(Boolean);
      const insideAnchor = anchorEls.some((el) => el.contains(target));
      const insideDropdown = target.closest?.('.dropdown-panel');
      if (insideAnchor || insideDropdown) return;
      if (filtersOpen) setFiltersOpen(false);
      if (locationOpen) {
        setLocationOpen(false);
        setAddrOpen(false);
      }
    };
    document.addEventListener('touchstart', handleOutsideInteraction, true);
    document.addEventListener('mousedown', handleOutsideInteraction, true);
    return () => {
      document.removeEventListener('touchstart', handleOutsideInteraction, true);
      document.removeEventListener('mousedown', handleOutsideInteraction, true);
    };
  }, [filtersOpen, locationOpen, setAddrOpen]);

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
      const data = await fetchJsonWithTimeout(url.toString());
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

  // If the popup is closed, also clear the focused business so it doesn't immediately reopen.
  useEffect(() => {
    if (!activeBiz) {
      setFocusedBusinessId(null);
    }
  }, [activeBiz]);

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
    handleFocusBusiness(biz);
  }, [handleFocusBusiness]);

  const mobilePeekList = (
    <div className="lg:hidden px-2 sm:px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Nearby businesses</h2>
        {center && (
          <span className="text-xs text-white/60">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {!center ? (
        <div className="text-sm text-white/60 pb-2">
          Pick a location to discover small businesses around you.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-white/60 pb-2">
          No results matched your filters. Try widening the radius or adjusting your search.
        </div>
      ) : (
        <div className="peek-cards" role="list">
          {filtered.map((biz) => {
            const distance = haversineMi(center, biz);
            const dLabel = typeof distance === 'number' && Number.isFinite(distance)
              ? `${distance.toFixed(1)} mi`
              : '';
            const directions = (typeof biz.lat === 'number' && typeof biz.lng === 'number')
              ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.name)}`;
            return (
              <div
                key={biz.id}
                role="listitem"
                className="peek-card"
                onClick={() => handleFocusBusiness(biz)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate">{biz.name || 'Untitled'}</div>
                    <div className="mt-1 text-xs text-white/60 flex items-center gap-1">
                      <MapPin size={14} className="text-white/40 shrink-0" />
                      <span className="truncate">{formatAddress(biz)}</span>
                    </div>
                    {biz.description && (
                      <p className="mt-2 text-xs text-white/70 line-clamp-2">
                        {biz.description}
                      </p>
                    )}
                  </div>
                  {dLabel && (
                    <span className="chip text-[11px] px-2 py-0.5 shrink-0">
                      {dLabel}
                    </span>
                  )}
                </div>

                <div className="peek-card__actions">
                  {biz.phone_number && (
                    <a
                      href={`tel:${biz.phone_number}`}
                      className="btn btn-ghost text-xs rounded-lg px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={14} />
                      Call
                    </a>
                  )}
                  <a
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary text-xs rounded-lg px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Directions
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const canUsePortal = typeof document !== 'undefined';
  const activeBizInfo = activeBiz && !activeBiz.clusterItems ? buildPopupData(activeBiz, center || WILMINGTON_CENTER) : null;

  const locationRect = locationPanelRect || getVisibleLocationRect();
  const locationDropdown = canUsePortal && locationOpen && locationRect
    ? createPortal(
        <div
          className="dropdown-panel dropdown-panel--overlay dropdown-panel--location"
          style={{
            top: locationRect.top,
            left: locationRect.left,
            width: locationRect.width,
            '--location-panel-top': `${locationRect.top}px`,
          }}
          onMouseDown={(e) => {
            locationDropdownPressRef.current = true;
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            locationDropdownPressRef.current = true;
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            className="dropdown-item dropdown-item--action"
            onClick={() => applyCurrentLocation({ skipIfLocked: false })}
          >
            Use current location
          </button>
          <div className="dropdown-scroll">
            {addrFetching && <div className="dropdown-empty">Searching...</div>}
            {!addrFetching && locationSuggestions.length === 0 && (
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
                  setAddrQuery(s.label || '', { keepLocked: true });
                  lockAddressInput();
                  setCenterLabel(s.label || 'chosen address');
                  setLocationOpen(false);
                  setAddrOpen(false);
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
    <div className="min-h-[100svh] min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <main className="flex-1 flex flex-col">
        <section className="flex-1 pt-8 pb-16 lg:pt-10 lg:pb-20 px-2 sm:px-4 lg:px-6">
          <div className="w-full flex flex-col gap-8 lg:gap-10">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)]/92 backdrop-blur-xl shadow-2xl px-5 py-5 md:px-7 md:py-6 hidden lg:block">
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

                <div className={`relative flex-1 min-w-[220px] max-w-md ${locationOpen ? 'z-50' : ''}`} ref={locationRefDesktop}>
                  <div className="relative">
                    <LocateFixed className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={18} />
                    <input
                      type="text"
                      value={addrQuery}
                      autoComplete="street-address"
                      autoCorrect="off"
                      spellCheck="false"
                      inputMode="text"
                      enterKeyHint="search"
                      onFocus={() => {
                        handleLocationFocus();
                        const shouldAutoLocate =
                          !centerLockedRef.current && (!addrQuery || addrQuery === 'Current location');
                        if (shouldAutoLocate && !currentLocationRequestRef.current) {
                          if (navigator?.permissions?.query) {
                            navigator.permissions
                              .query({ name: 'geolocation' })
                              .then((status) => {
                                if (status.state === 'granted') {
                                  applyCurrentLocation({ skipIfLocked: false });
                                }
                              })
                              .catch(() => {});
                          } else {
                            applyCurrentLocation({ skipIfLocked: false });
                          }
                        }
                      }}
                      onClick={() => {
                        handleLocationFocus();
                      }}
                      onMouseDown={() => {
                        handleLocationFocus();
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAddrQuery(value);
                        unlockAddressInput();
                        setLocationOpen(true);
                        if (value && value.trim().length >= 1) {
                          setAddrOpen(true);
                          searchAddress(value);
                        } else {
                          setAddrOpen(false);
                        }
                      }}
                      onBlur={() => {
                        if (locationDropdownPressRef.current) {
                          // allow clicks inside the dropdown without closing
                          locationDropdownPressRef.current = false;
                          return;
                        }
                        const trimmed = (addrQuery || '').trim();
                        if (!trimmed && prevLocationValueRef.current) {
                          setAddrQuery(prevLocationValueRef.current, { keepLocked: true });
                        }
                        setLocationOpen(false);
                        setAddrOpen(false);
                      }}
                      placeholder="Location"
                      className="w-full h-11 rounded-2xl bg-[var(--bg-alt)] border border-[var(--border)] pl-12 pr-4 text-base focus:outline-none focus:border-[var(--ceramic)] focus:ring-0"
                    />
                  </div>
                </div>

                <div className={`relative ${filtersOpen ? 'z-50' : ''}`} ref={filtersRefDesktop}>
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

            <div className="home-results-grid grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch">
            <div
              ref={mapSectionRef}
              className="home-map-panel rounded-3xl border border-[var(--border)] bg-[var(--bg-alt)]/70 relative overflow-hidden z-0 order-1 lg:order-none h-full"
            >
              <ResultsMap
                center={center}
                items={filtered.filter((b) => !b.hide_address)}
                focusBusiness={focusBusiness}
                mapStyle={mapStyle}
                onCloseup={handleCloseupRequest}
                setCenter={setCenter}
                setCenterLabel={setCenterLabel}
                  radiusMi={radiusMi}
                  activeBiz={activeBiz}
                  setActiveBiz={setActiveBiz}
                  restoreActiveRef={restoreActiveRef}
                />
              </div>

              <div className="home-search-panel rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)]/92 backdrop-blur-xl shadow-2xl px-5 py-5 md:px-7 md:py-6 order-2 lg:order-none lg:hidden">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                    <input
                      value={what}
                      onChange={(e) => setWhat(e.target.value)}
                      type="text"
                      placeholder="Search by name, product, or area..."
                      className="w-full h-11 rounded-2xl bg-[var(--bg-alt)] border border-[var(--border)] pl-12 pr-4 text-base focus:outline-none focus:border-[var(--ceramic)] focus:ring-0"
                    />
                  </div>

                  <div className={`relative flex-1 min-w-[220px] ${locationOpen ? 'z-50' : ''}`} ref={locationRefMobile}>
                    <div className="relative">
                      <LocateFixed className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={18} />
                      <input
                        type="text"
                        value={addrQuery}
                        autoComplete="street-address"
                        autoCorrect="off"
                        spellCheck="false"
                        inputMode="text"
                        enterKeyHint="search"
                      onFocus={() => {
                        handleLocationFocus();
                        const shouldAutoLocate =
                          !centerLockedRef.current && (!addrQuery || addrQuery === 'Current location');
                        if (shouldAutoLocate && !currentLocationRequestRef.current) {
                          if (navigator?.permissions?.query) {
                            navigator.permissions
                              .query({ name: 'geolocation' })
                              .then((status) => {
                                if (status.state === 'granted') {
                                  applyCurrentLocation({ skipIfLocked: false });
                                }
                              })
                              .catch(() => {});
                          } else {
                            applyCurrentLocation({ skipIfLocked: false });
                          }
                        }
                      }}
                      onClick={() => {
                        handleLocationFocus();
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAddrQuery(value);
                        unlockAddressInput();
                        setLocationOpen(true);
                        if (value && value.trim().length >= 1) {
                          setAddrOpen(true);
                          searchAddress(value);
                        } else {
                          setAddrOpen(false);
                        }
                      }}
                      onBlur={() => {
                        if (locationDropdownPressRef.current) {
                          locationDropdownPressRef.current = false;
                          return;
                        }
                        const trimmed = (addrQuery || '').trim();
                        if (!trimmed && prevLocationValueRef.current) {
                          setAddrQuery(prevLocationValueRef.current, { keepLocked: true });
                        }
                        setLocationOpen(false);
                        setAddrOpen(false);
                      }}
                      placeholder="Location"
                      className="w-full h-11 rounded-2xl bg-[var(--bg-alt)] border border-[var(--border)] pl-12 pr-4 text-base focus:outline-none focus:border-[var(--ceramic)] focus:ring-0"
                    />
                  </div>
                </div>

                  <div className={`relative ${filtersOpen ? 'z-50' : ''}`} ref={filtersRefMobile}>
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

              <div className="home-results-panel home-results-panel--desktop rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)]/92 backdrop-blur-lg shadow-2xl p-5 hidden lg:flex flex-col relative z-10 order-3 lg:order-none h-full">
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
                  <ul className="home-results-list space-y-4" role="list">
                    {filtered.map((biz) => {
                      const isFocused = focusedBusinessId === biz.id;
                      const distance = haversineMi(center, biz);
                      const dLabel = typeof distance === 'number' && Number.isFinite(distance)
                        ? `${distance.toFixed(1)} mi`
                        : '';
                      const directions = (typeof biz.lat === 'number' && typeof biz.lng === 'number')
                        ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.name)}`;
                      const canFocus = typeof biz.lat === 'number' && typeof biz.lng === 'number' && !biz.hide_address;
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
                            {!biz.hide_address && (
                              <a
                                href={directions}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-primary text-sm rounded-xl px-3 py-2"
                              >
                                Directions
                              </a>
                            )}
                            {canFocus && !biz.hide_address && (
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

            {mobilePeekList}

      {activeBiz?.clusterItems && (
        <div className="map-biz-sheet map-biz-sheet--mobile lg:hidden">
          <button
            type="button"
            className="map-biz-sheet__handle"
            onClick={() => {
              if (restoreActiveRef.current) {
                restoreActiveRef.current();
              } else {
                setActiveBiz(null);
              }
            }}
            aria-label="Close details"
          />
          <div className="map-biz-sheet__content map-biz-sheet__content--scroll">
            <div className="map-biz-sheet__header">
              <div>
                <div className="map-biz-sheet__title">Businesses in this area</div>
                <div className="map-biz-sheet__subtitle text-white/70 text-sm">
                  {activeBiz.clusterItems.length} result{activeBiz.clusterItems.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {activeBiz.clusterItems.map((biz) => {
                const info = buildPopupData(biz, center || WILMINGTON_CENTER);
                return (
                  <div key={biz.id ?? `${biz.lat}-${biz.lng}`} className="map-biz-sheet__cluster-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="map-biz-sheet__title text-base">{info.name}</div>
                        {info.address && (
                          <div className="map-biz-sheet__subtitle">
                            <MapPin size={14} className="text-white/50" />
                            <span className="truncate">{info.address}</span>
                          </div>
                        )}
                        {info.description && (
                          <p className="text-sm text-white/70 mt-1 line-clamp-2">{info.description}</p>
                        )}
                      </div>
                      {info.distanceLabel && <span className="chip chip--pill">{info.distanceLabel}</span>}
                    </div>
                    <div className="map-biz-sheet__actions">
                      {info.callHref && (
                        <a className="btn btn-ghost" href={info.callHref}>
                          <Phone size={16} />
                          Call
                        </a>
                      )}
                      {info.directionsHref && (
                        <a className="btn btn-primary" href={info.directionsHref} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                          Directions
                        </a>
                      )}
                      {biz?.id != null && (
                        <Link className="btn btn-ghost" to={`/business/${biz.id}`}>
                          Details
                        </Link>
                      )}
                      {typeof biz.lat === 'number' && typeof biz.lng === 'number' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleFocusBusiness(biz)}
                        >
                          Zoom to pin
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeBizInfo && (
        <div className="map-biz-sheet map-biz-sheet--mobile lg:hidden">
          <button
            type="button"
            className="map-biz-sheet__handle"
            onClick={() => {
              if (restoreActiveRef.current) {
                restoreActiveRef.current();
              } else {
                setActiveBiz(null);
              }
            }}
            aria-label="Close details"
          />
          <div className="map-biz-sheet__header">
            <div>
              <div className="map-biz-sheet__title">{activeBizInfo.name}</div>
              {activeBizInfo.address && (
                <div className="map-biz-sheet__subtitle">
                  <MapPin size={14} className="text-white/50" />
                  <span>{activeBizInfo.address}</span>
                </div>
              )}
            </div>
            {activeBizInfo.distanceLabel && (
              <span className="chip chip--pill">{activeBizInfo.distanceLabel}</span>
            )}
          </div>
            <div className="map-biz-sheet__meta">
              <div className="map-biz-sheet__image" aria-hidden="true">
                <span>Photo</span>
              </div>
              <div className="map-biz-sheet__summary">
              {activeBizInfo.description && (
                <p className="map-biz-sheet__desc">{activeBizInfo.description}</p>
              )}
              <div className="map-biz-sheet__tags">
                <span className="chip">Reviews</span>
                <span className="chip">Hours</span>
                <span className="chip">Amenities</span>
              </div>
            </div>
          </div>
          <div className="map-biz-sheet__actions">
            {activeBizInfo.callHref && (
              <a className="btn btn-ghost" href={activeBizInfo.callHref}>
                <Phone size={16} />
                Call
              </a>
            )}
            {activeBizInfo.directionsHref && (
              <a className="btn btn-primary" href={activeBizInfo.directionsHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Directions
              </a>
            )}
            {activeBiz?.id != null && (
              <Link className="btn btn-ghost" to={`/business/${activeBiz.id}`}>
                Details
              </Link>
            )}
          </div>
        </div>
      )}

            <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-r from-[var(--bg-panel)]/95 via-[var(--bg-alt)] to-[var(--bg-panel)]/95 px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
              <div className="text-center md:text-left">
                <h3 className="text-xl font-semibold text-white">
                  Own a small business? Get featured on Bizcribe.
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
            &copy; {new Date().getFullYear()} Bizcribe &middot; Map data &copy; OpenStreetMap contributors & Mapbox
          </div>
        </footer>
      </main>
    </div>
    {locationDropdown}
    {filtersDropdown}
    </>
  );
}

function ResultsMap({
  center,
  items,
  focusBusiness,
  mapStyle = MAPBOX_DEFAULT_STYLE,
  onCloseup,
  setCenter,
  setCenterLabel,
  radiusMi,
  activeBiz,
  setActiveBiz,
  restoreActiveRef,
}) {
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const [mapReady, setMapReady] = useState(false);
  const [followMapCenter, setFollowMapCenter] = useState(false);
  const [followItems, setFollowItems] = useState(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const clusterMarkersRef = useRef([]);
  const youMarkerRef = useRef(null);
  const centerRef = useRef(center);
  const lastStyleRef = useRef(mapStyle);
  const pendingCloseupRef = useRef(false);
  const suppressCloseRef = useRef(false);
  const lastMarkersKeyRef = useRef('');
  const lastViewRef = useRef(null);
  const restoringRef = useRef(false);

  useEffect(() => { centerRef.current = center; }, [center]);

  useEffect(() => {
    if (!followMapCenter) {
      setFollowItems(null);
    }
  }, [followMapCenter]);

  const fetchFollowItems = useCallback(
    async (lngLat) => {
      if (!followMapCenter || !lngLat) return;
      try {
        const url = new URL('/api/businesses/', window.location.origin);
        url.searchParams.set('near', `${lngLat.lat.toFixed(6)},${lngLat.lng.toFixed(6)}`);
        url.searchParams.set('radius_km', String(toKm(radiusMi)));
        url.searchParams.set('limit', '200');
        const data = await fetchJsonWithTimeout(url.toString());
        setFollowItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Follow fetch failed', err);
      }
    },
    [followMapCenter, radiusMi],
  );

  const removeYouMarker = useCallback(() => {
    if (youMarkerRef.current) {
      cleanupMarkerElement(youMarkerRef.current);
      youMarkerRef.current.remove();
      youMarkerRef.current = null;
    }
  }, []);

  const getPreferredZoom = useCallback(() => {
    const map = mapRef.current;
    const maxZoom = map?.getMaxZoom?.() ?? 20;
    return Math.max(3, maxZoom - 8); // 8 clicks out from max
  }, []);

  const closeActiveAndRestore = useCallback(() => {
    setActiveBiz(null);
    const map = mapRef.current;
    if (!map || restoringRef.current) return;
    if (lastViewRef.current && lastViewRef.current.center && typeof lastViewRef.current.zoom === 'number') {
      const { center: prevCenter, zoom: prevZoom } = lastViewRef.current;
      restoringRef.current = true;
      map.flyTo({
        center: [prevCenter.lng, prevCenter.lat],
        zoom: prevZoom,
        duration: 400,
        essential: true,
      });
      map.once('moveend', () => {
        restoringRef.current = false;
      });
    }
  }, [setActiveBiz]);

  useEffect(() => {
    if (restoreActiveRef) {
      restoreActiveRef.current = closeActiveAndRestore;
      return () => {
        if (restoreActiveRef.current === closeActiveAndRestore) {
          restoreActiveRef.current = null;
        }
      };
    }
    return undefined;
  }, [restoreActiveRef, closeActiveAndRestore]);

  const focusOnBusiness = useCallback(() => {
    if (!focusBusiness || mapboxFailed || !mapRef.current) return;
    const coords = toLngLatTuple(focusBusiness);
    if (!coords) return;
    const [lng, lat] = coords;
    const map = mapRef.current;
    const targetZoom = getPreferredZoom();
    const mapCenter = map.getCenter();
    lastViewRef.current = { center: { lat: mapCenter.lat, lng: mapCenter.lng }, zoom: map.getZoom() };
    suppressCloseRef.current = true;

    map.flyTo({
      center: [lng, lat],
      zoom: targetZoom,
      duration: 700,
      essential: true,
    });

    map.once('moveend', () => {
      pendingCloseupRef.current = false;
      suppressCloseRef.current = false;
      setActiveBiz(focusBusiness);
    });

  }, [focusBusiness, mapboxFailed, setActiveBiz, getPreferredZoom]);

  const updateMapboxMarkerAppearance = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const hideBusinessMarkers = zoom < MARKER_HIDE_ZOOM;
    const markerScale = markerScaleForZoom(zoom);

    markersRef.current.forEach((marker) => {
      if (typeof marker.getElement !== 'function') return;
      const el = marker.getElement();
      if (!el) return;
      if (hideBusinessMarkers) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.setProperty('--marker-scale', markerScale.toString());
      }
    });

    if (youMarkerRef.current && typeof youMarkerRef.current.getElement === 'function') {
      const el = youMarkerRef.current.getElement();
      if (el) {
        el.style.setProperty('--marker-scale', markerScale.toString());
      }
    }
  }, []);

  const rebuildMarkers = useCallback(() => {
    if (mapboxFailed || !mapRef.current) return;

    const map = mapRef.current;
    const zoom = map.getZoom();
    const rawItems = followMapCenter && Array.isArray(followItems) && followItems.length
      ? followItems
      : items;
    const sourceItems = (rawItems || []).filter((biz) => !biz.hide_address);
    const clusteringEnabled = zoom < 16;
    const center = map.getCenter();
    const centerKey = `${center?.lat?.toFixed?.(4) ?? ''},${center?.lng?.toFixed?.(4) ?? ''}`;
    const key = `${clusteringEnabled ? 'c' : 'm'}:${zoom.toFixed(2)}:${centerKey}:${sourceItems
      .map((b) => b.id || `${b.lat},${b.lng}`)
      .join('|')}`;
    if (key === lastMarkersKeyRef.current) return;
    lastMarkersKeyRef.current = key;

    markersRef.current.forEach((marker) => {
      cleanupMarkerElement(marker);
      marker.remove();
    });
    markersRef.current.clear();
    clusterMarkersRef.current.forEach((marker) => {
      cleanupMarkerElement(marker);
      marker.remove();
    });
    clusterMarkersRef.current = [];
    const thresholdPx = clusteringEnabled
      ? clamp(44 - ((zoom - 10) * 6), 14, 44)
      : 0;
    const addBusinessMarker = (biz) => {
      const element = createMarkerElement(biz.name || 'Business location', 'business');
      if (!element) return;
      const marker = new mapboxgl.Marker({ element, anchor: 'bottom' });

      marker.setLngLat([biz.lng, biz.lat]);
      marker.addTo(map);
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        const mapCenter = map.getCenter();
        lastViewRef.current = { center: { lat: mapCenter.lat, lng: mapCenter.lng }, zoom: map.getZoom() };
        setActiveBiz(biz);
        suppressCloseRef.current = true;
        const targetZoom = getPreferredZoom();
        map.flyTo({
          center: [biz.lng, biz.lat],
          zoom: targetZoom,
          duration: 500,
          essential: true,
        });
        map.once('moveend', () => {
          suppressCloseRef.current = false;
          setActiveBiz(biz);
        });
      });
      if (biz?.id != null) {
        markersRef.current.set(biz.id, marker);
      }
    };

    if (!clusteringEnabled) {
      (sourceItems || []).forEach((biz) => {
        if (typeof biz.lng !== 'number' || typeof biz.lat !== 'number') return;
        if (biz.__youMarker) return;
        addBusinessMarker(biz);
      });
    } else {
      const clusters = [];
      const projected = [];

      (sourceItems || []).forEach((biz) => {
        if (typeof biz.lng !== 'number' || typeof biz.lat !== 'number') return;
        if (biz.__youMarker) return;
        const point = map.project([biz.lng, biz.lat]);
        projected.push({ biz, point });
      });

      projected.forEach(({ biz, point }) => {
        let target = null;
        for (const c of clusters) {
          const dx = c.point.x - point.x;
          const dy = c.point.y - point.y;
          if (Math.hypot(dx, dy) <= thresholdPx) {
            target = c;
            break;
          }
        }
        if (target) {
          target.items.push(biz);
          target.point = {
            x: (target.point.x * (target.items.length - 1) + point.x) / target.items.length,
            y: (target.point.y * (target.items.length - 1) + point.y) / target.items.length,
          };
        } else {
          clusters.push({ items: [biz], point });
        }
      });

      clusters.forEach((cluster) => {
        const [lng, lat] = map.unproject(cluster.point).toArray();
        if (cluster.items.length > 1) {
          const element = createMarkerElement(`${cluster.items.length} businesses`, 'cluster', String(cluster.items.length));
          if (!element) return;
          const marker = new mapboxgl.Marker({ element, anchor: 'bottom' });
          marker.setLngLat([lng, lat]).addTo(map);
          clusterMarkersRef.current.push(marker);
          element.onclick = (e) => {
            e.stopPropagation();
            setActiveBiz({ clusterItems: cluster.items });
          };
        } else {
          addBusinessMarker(cluster.items[0]);
        }
      });
    }

    updateMapboxMarkerAppearance();
    focusOnBusiness();
  }, [items, followItems, followMapCenter, mapboxFailed, center, focusOnBusiness, onCloseup, updateMapboxMarkerAppearance]);

  useEffect(() => {
    const map = mapRef.current;
    if (mapboxFailed) {
      removeYouMarker();
      return;
    }
    if (!map || !mapReady) {
      return;
    }
    const coords = toLngLatTuple(center) || [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
    if (!youMarkerRef.current) {
      const element = createMarkerElement('Your location', 'you');
      if (!element) return;
      const marker = new mapboxgl.Marker({ element, anchor: 'bottom' });
      marker.setLngLat(coords).addTo(map);
      youMarkerRef.current = marker;
    } else {
      youMarkerRef.current.setLngLat(coords);
    }
    updateMapboxMarkerAppearance();
  }, [center, mapboxFailed, mapReady, removeYouMarker, updateMapboxMarkerAppearance]);

  useEffect(() => {
    if (mapRef.current || mapboxFailed) return;
    if (!containerRef.current) return;
    const preferredCenter = toLngLatTuple(centerRef.current);
    const startingCenter = preferredCenter || [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mapboxStyleUrl(mapStyle),
        center: startingCenter,
        zoom: DEFAULT_ZOOM,
        minZoom: HOME_MIN_ZOOM,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        map.resize();
        setMapReady(true);
      });
      map.on('error', () => {
        setMapboxFailed(true);
      });
    } catch (error) {
      console.warn('Mapbox map failed to initialise', error);
      setMapboxFailed(true);
    }

    const markersMap = markersRef.current;
    return () => {
      markersMap.forEach((marker) => {
        cleanupMarkerElement(marker);
        marker.remove();
      });
      markersMap.clear();
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
    const map = mapRef.current;
    const handleResize = () => {
      mapRef.current?.resize();
    };
    const handleMapClick = () => {
      closeActiveAndRestore();
    };
    const handleUserMove = () => {
      if (suppressCloseRef.current) return;
      if (activeBiz) setActiveBiz(null);
    };
    handleResize();
    map.on('click', handleMapClick);
    map.on('dragstart', handleUserMove);
    map.on('zoomstart', handleUserMove);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      map.off('click', handleMapClick);
      map.off('dragstart', handleUserMove);
      map.off('zoomstart', handleUserMove);
    };
  }, [mapboxFailed, setActiveBiz, activeBiz, closeActiveAndRestore]);

  useEffect(() => {
    if (mapboxFailed) {
      setActiveBiz(null);
    }
  }, [mapboxFailed, setActiveBiz]);

  useEffect(() => {
    rebuildMarkers();
  }, [rebuildMarkers]);

  useEffect(() => {
    if (mapboxFailed || !mapRef.current) return;
    const map = mapRef.current;
    const handleZoom = () => updateMapboxMarkerAppearance();
    const handleZoomEnd = () => rebuildMarkers();
    map.on('zoom', handleZoom);
    map.on('zoomend', handleZoomEnd);
    handleZoom();
    return () => {
      map.off('zoom', handleZoom);
      map.off('zoomend', handleZoomEnd);
    };
  }, [mapboxFailed, updateMapboxMarkerAppearance, rebuildMarkers]);

  useEffect(() => {
    if (mapboxFailed || !mapRef.current) return;
    const map = mapRef.current;
    const handleMoveEnd = () => {
      const c = map.getCenter();
      centerRef.current = { lat: c.lat, lng: c.lng };
      if (followMapCenter) {
        fetchFollowItems({ lat: c.lat, lng: c.lng });
      } else {
        rebuildMarkers();
      }
    };
    map.on('moveend', handleMoveEnd);
    return () => map.off('moveend', handleMoveEnd);
  }, [followMapCenter, mapboxFailed, fetchFollowItems, rebuildMarkers]);

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

  const activeInfo = activeBiz
    ? activeBiz.clusterItems
      ? null
      : buildPopupData(activeBiz, centerRef.current || center)
    : null;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      <div className="map-overlay map-overlay--right">
        <button
          type="button"
          className={`map-overlay__btn ${followMapCenter ? 'is-active' : ''}`}
          onClick={() => setFollowMapCenter((v) => !v)}
        >
          <Disc2 size={14} />
          {followMapCenter ? 'Follow: on' : 'Follow: off'}
        </button>
        <button
          type="button"
          className="map-overlay__btn"
          onClick={() => {
            const map = mapRef.current;
            const target = toLngLatTuple(center) || [WILMINGTON_CENTER.lng, WILMINGTON_CENTER.lat];
            if (!map || !target) return;
            map.flyTo({ center: target, zoom: DEFAULT_ZOOM, duration: 500, essential: true });
          }}
        >
          <LocateFixed size={14} />
          Reset view
        </button>
      </div>
      {activeBiz?.clusterItems && (
        <div className="map-biz-overlay map-biz-overlay--desktop hidden lg:flex">
          <div className="map-biz-sheet map-biz-sheet--desktop">
            <div className="map-biz-sheet__top">
              <button
                type="button"
                className="map-biz-sheet__handle"
                onClick={closeActiveAndRestore}
                aria-label="Close details"
              />
              <button
                type="button"
                className="map-biz-sheet__close"
                onClick={closeActiveAndRestore}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="map-biz-sheet__content map-biz-sheet__content--scroll">
              <div className="map-biz-sheet__header">
                <div>
                  <div className="map-biz-sheet__title">Businesses in this area</div>
                  <div className="map-biz-sheet__subtitle text-white/70 text-sm">
                    {activeBiz.clusterItems.length} result{activeBiz.clusterItems.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {activeBiz.clusterItems.map((biz) => {
                  const info = buildPopupData(biz, centerRef.current || center);
                  return (
                    <div key={biz.id ?? `${biz.lat}-${biz.lng}`} className="map-biz-sheet__cluster-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="map-biz-sheet__title text-base">{info.name}</div>
                          {info.address && (
                            <div className="map-biz-sheet__subtitle">
                              <MapPin size={14} className="text-white/50" />
                              <span className="truncate">{info.address}</span>
                            </div>
                          )}
                          {info.description && (
                            <p className="text-sm text-white/70 mt-1 line-clamp-2">{info.description}</p>
                          )}
                        </div>
                        {info.distanceLabel && <span className="chip chip--pill">{info.distanceLabel}</span>}
                      </div>
                      <div className="map-biz-sheet__actions">
                        {info.callHref && (
                          <a className="btn btn-ghost" href={info.callHref}>
                            <Phone size={16} />
                            Call
                          </a>
                        )}
                      {info.directionsHref && (
                          <a className="btn btn-primary" href={info.directionsHref} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} />
                            Directions
                          </a>
                        )}
                        {biz?.id != null && (
                          <Link className="btn btn-ghost" to={`/business/${biz.id}`}>
                            Details
                          </Link>
                        )}
                        {typeof biz.lat === 'number' && typeof biz.lng === 'number' && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              const map = mapRef.current;
                              if (!map) return;
                              const targetZoom = getPreferredZoom();
                              map.flyTo({
                                center: [biz.lng, biz.lat],
                                zoom: targetZoom,
                                duration: 600,
                                essential: true,
                              });
                              setActiveBiz(biz);
                            }}
                          >
                            Zoom to pin
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeInfo && !activeBiz?.clusterItems && (
        <div className="map-biz-overlay map-biz-overlay--desktop hidden lg:flex">
          <div className="map-biz-sheet map-biz-sheet--desktop">
            <div className="map-biz-sheet__top">
              <button
                type="button"
                className="map-biz-sheet__handle"
                onClick={closeActiveAndRestore}
                aria-label="Close details"
              />
              <button
                type="button"
                className="map-biz-sheet__close"
                onClick={closeActiveAndRestore}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="map-biz-sheet__content map-biz-sheet__content--scroll">
              <div className="map-biz-sheet__header">
                <div>
                  <div className="map-biz-sheet__title">{activeInfo.name}</div>
                  {activeInfo.address && (
                    <div className="map-biz-sheet__subtitle">
                      <MapPin size={14} className="text-white/50" />
                      <span>{activeInfo.address}</span>
                    </div>
                  )}
                </div>
                {activeInfo.distanceLabel && (
                  <span className="chip chip--pill">{activeInfo.distanceLabel}</span>
                )}
              </div>
              <div className="map-biz-sheet__meta">
                <div className="map-biz-sheet__image" aria-hidden="true">
                  <span>Photo</span>
                </div>
                <div className="map-biz-sheet__summary">
                  {activeInfo.description && (
                    <p className="map-biz-sheet__desc">{activeInfo.description}</p>
                  )}
                  <div className="map-biz-sheet__tags">
                    <span className="chip">Reviews</span>
                    <span className="chip">Hours</span>
                    <span className="chip">Amenities</span>
                  </div>
                </div>
              </div>
              <div className="map-biz-sheet__actions">
                {activeInfo.callHref && (
                  <a className="btn btn-ghost" href={activeInfo.callHref}>
                    <Phone size={16} />
                    Call
                  </a>
                )}
                {activeInfo.directionsHref && (
                  <a className="btn btn-primary" href={activeInfo.directionsHref} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Directions
                  </a>
                )}
                {activeBiz?.id != null && (
                  <Link className="btn btn-ghost" to={`/business/${activeBiz.id}`}>
                    Details
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeafletFallback({ center, items, focusBusiness, onCloseup }) {
  const tileProps = osmTileProps();
  const mapCenter = center ? [center.lat, center.lng] : [WILMINGTON_CENTER.lat, WILMINGTON_CENTER.lng];
  const initialZoom = center ? DEFAULT_ZOOM : HOME_MIN_ZOOM + 1;
  const zoom = Math.max(initialZoom, HOME_MIN_ZOOM + 1);
  const mapRef = useRef(null);
  const [leafletMap, setLeafletMap] = useState(null);
  const [overlayEl, setOverlayEl] = useState(null);
  const [projectedItems, setProjectedItems] = useState([]);
  const [projectedCenter, setProjectedCenter] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const pendingCloseupRef = useRef(false);
  const popupRef = useRef(null);

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

  const detachPopup = useCallback(() => {
    if (popupRef.current) {
      const existing = popupRef.current;
      if (typeof existing.__unmount === 'function') {
        existing.__unmount();
        existing.__unmount = null;
      }
      existing.remove();
      popupRef.current = null;
    }
  }, []);

  const openLeafletPopup = useCallback(
    (biz) => {
      if (!leafletMap) return;
      const coords = toLeafletTuple(biz);
      if (!coords) return;
      detachPopup();
      const info = buildPopupData(biz, center);
      const { element, unmount } = createPopupElement(info, () => handleLeafletCloseup(biz));
      const popup = L.popup({ offset: [0, -12], closeButton: false }).setLatLng(coords).addTo(leafletMap);
      if (element) {
        popup.setContent(element);
      }
      popup.__unmount = unmount;
      popup.on('remove', () => {
        if (typeof popup.__unmount === 'function') {
          popup.__unmount();
          popup.__unmount = null;
        }
      });
      popupRef.current = popup;
    },
    [center, detachPopup, handleLeafletCloseup, leafletMap],
  );

  const updateOverlayPositions = useCallback(() => {
    const map = leafletMap;
    if (!map) return;
    const projectPoint = (lat, lng) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      const point = map.latLngToLayerPoint([lat, lng]);
      if (!point) return null;
      return { x: point.x, y: point.y };
    };
    const youPoint = center ? projectPoint(center.lat, center.lng) : null;
    const markerPoints = (items || [])
      .map((biz) => {
        if (typeof biz.lat !== 'number' || typeof biz.lng !== 'number') return null;
        const point = projectPoint(biz.lat, biz.lng);
        if (!point) return null;
        return { biz, point };
      })
      .filter(Boolean);
    setProjectedCenter(youPoint);
    setProjectedItems(markerPoints);
  }, [center, items, leafletMap]);

  useEffect(() => {
    return () => {
      mapRef.current = null;
      detachPopup();
    };
  }, [detachPopup]);

  useEffect(() => {
    if (!focusBusiness) {
      pendingCloseupRef.current = false;
      return;
    }
    if (!leafletMap) return;
    const leafletCoords = toLeafletTuple(focusBusiness);
    if (!leafletCoords) return;
    const currentZoom = leafletMap.getZoom?.() ?? DEFAULT_ZOOM;
    const closeupRequested = pendingCloseupRef.current;
    const targetZoom = closeupRequested
      ? Math.min(leafletMap.getMaxZoom?.() || 21, Math.max(currentZoom, 18))
      : Math.max(currentZoom, 16);
    leafletMap.flyTo(leafletCoords, targetZoom, { duration: 0.6 });
    openLeafletPopup(focusBusiness);
    pendingCloseupRef.current = false;
  }, [focusBusiness, openLeafletPopup, leafletMap]);

  useEffect(() => {
    if (!leafletMap) return;
    const panes = leafletMap.getPanes();
    if (!panes?.overlayPane) return;
    const overlay = document.createElement('div');
    overlay.className = 'leaflet-marker-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    panes.overlayPane.appendChild(overlay);
    setOverlayEl(overlay);
    updateOverlayPositions();
    const handleMove = () => updateOverlayPositions();
    leafletMap.on('move zoom resize', handleMove);
    return () => {
      leafletMap.off('move zoom resize', handleMove);
      panes.overlayPane.removeChild(overlay);
      setOverlayEl(null);
    };
  }, [leafletMap, updateOverlayPositions]);

  useEffect(() => {
    updateOverlayPositions();
  }, [center, items, updateOverlayPositions]);

  useEffect(() => {
    if (!leafletMap) return;
    const handleZoomChange = () => setCurrentZoom(leafletMap.getZoom());
    handleZoomChange();
    leafletMap.on('zoom', handleZoomChange);
    return () => leafletMap.off('zoom', handleZoomChange);
  }, [leafletMap]);

  useEffect(() => {
    if (!leafletMap || !center) return;
    const coords = toLeafletTuple(center);
    if (!coords) return;
    leafletMap.flyTo(coords, DEFAULT_ZOOM, { duration: 0.5 });
  }, [center, leafletMap]);

  const markerOffset = { x: 18, y: 36 };

  const overlayContent =
    overlayEl && projectedItems
      ? createPortal(
          <>
            {projectedItems.map(({ biz, point }) => (
              <button
                type="button"
                key={biz.id ?? `${point.x}-${point.y}`}
                className={`home-map__marker-wrapper ${focusBusiness?.id === biz.id ? 'home-map__marker--active' : ''}`}
                style={{
                  transform: `translate(${point.x - markerOffset.x}px, ${point.y - markerOffset.y}px)`,
                  pointerEvents: 'auto',
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  openLeafletPopup(biz);
                }}
              >
                <MapPin size={20} strokeWidth={2.2} />
              </button>
            ))}
            {projectedCenter && (
              <div
                className="home-map__you-dot"
                style={{
                  transform: `translate(${projectedCenter.x - 12}px, ${projectedCenter.y - 12}px)`,
                  pointerEvents: 'none',
                }}
              >
                <Disc2 size={20} strokeWidth={3} color="#e0e7ff" />
              </div>
            )}
          </>,
          overlayEl,
        )
      : null;

  return (
    <>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        minZoom={HOME_MIN_ZOOM}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        whenCreated={(map) => {
          mapRef.current = map;
          map.setMinZoom(HOME_MIN_ZOOM);
          setLeafletMap(map);
          setCurrentZoom(map.getZoom());
        }}
      >
        <TileLayer {...tileProps} />
      </MapContainer>
      {overlayContent}
    </>
  );
}










