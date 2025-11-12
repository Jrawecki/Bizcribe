import { useCallback, useMemo, useRef, useState } from 'react';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const parseMapboxFeature = (feature) => {
  const [lng, lat] = feature.center || [null, null];
  const label = feature.place_name || '';
  const ctx = feature.context || [];
  const byId = (prefix) => ctx.find((c) => (c.id || '').startsWith(prefix));
  const place = byId('place');
  const region = byId('region');
  const postcode = byId('postcode');
  const address = feature.place_type?.includes('address')
    ? [feature.address, feature.text].filter(Boolean).join(' ')
    : feature.place_type?.includes('poi')
    ? feature.text || ''
    : '';
  return {
    label,
    lat,
    lng,
    address: {
      line1: address,
      city: place?.text || '',
      state: region?.short_code ? region.short_code.replace('US-', '') : region?.text || '',
      zip: postcode?.text || '',
    },
  };
};

const parseNominatimFeature = (feature) => {
  const label = feature.display_name || '';
  const latValue = Number.parseFloat(feature.lat);
  const lngValue = Number.parseFloat(feature.lon);
  const addr = feature.address || {};
  const line1 = [addr.house_number, addr.road].filter(Boolean).join(' ');
  return {
    label,
    lat: Number.isFinite(latValue) ? latValue : null,
    lng: Number.isFinite(lngValue) ? lngValue : null,
    address: {
      line1: line1 || label,
      city: addr.city || addr.town || addr.village || addr.hamlet || '',
      state: addr.state || addr.region || '',
      zip: addr.postcode || '',
    },
  };
};

const fetchMapboxSuggestions = async (query) => {
  if (!MAPBOX_TOKEN) {
    return [];
  }
  try {
    const url = new URL(`${MAPBOX_ENDPOINT}/${encodeURIComponent(query)}.json`);
    url.searchParams.set('access_token', MAPBOX_TOKEN);
    url.searchParams.set('autocomplete', 'true');
    url.searchParams.set('country', 'US');
    url.searchParams.set('proximity', `${WILMINGTON_CENTER.lng},${WILMINGTON_CENTER.lat}`);
    url.searchParams.set('limit', '8');
    url.searchParams.set('types', 'address,place,postcode,poi');
    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en-US' } });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return (data.features || []).map(parseMapboxFeature);
  } catch (err) {
    console.warn('Mapbox geocoding failed, falling back to Nominatim', err);
    return [];
  }
};

const fetchNominatimSuggestions = async (query) => {
  try {
    const url = new URL(NOMINATIM_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '8');
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('email', 'jrawecki31@gmail.com');
    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en-US' } });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data.map(parseNominatimFeature) : [];
  } catch (err) {
    console.warn('Nominatim geocoding failed', err);
    return [];
  }
};

export function useAddressSearch() {
  const [query, setQueryState] = useState('');
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [list, setList] = useState([]);
  const lockedRef = useRef(false);

  const setQuery = useCallback(
    (value, options = {}) => {
      const { keepLocked = false } = options;
      setQueryState(value);
      if (!keepLocked && lockedRef.current) {
        lockedRef.current = false;
      }
      if (!value || value.trim().length < 3) {
        setOpen(false);
        setList([]);
      }
    },
    []
  );

  const search = useMemo(
    () =>
      debounce(async (value) => {
        const trimmed = value ? value.trim() : '';
        if (!trimmed || trimmed.length < 3 || lockedRef.current) {
          setList([]);
          setOpen(false);
          return;
        }
        if (/^[\d\s-]+$/.test(trimmed)) {
          const digitsOnly = trimmed.replace(/[^\d]/g, '');
          if (digitsOnly.length < 5) {
            setList([]);
            setOpen(false);
            return;
          }
        }
        setFetching(true);
        try {
          let results = await fetchMapboxSuggestions(trimmed);
          if (!results.length) {
            results = await fetchNominatimSuggestions(trimmed);
          }
          setList(results);
          setOpen(results.length > 0);
        } finally {
          setFetching(false);
        }
      }, 250),
    []
  );

  return {
    state: { query, setQuery, open, setOpen, fetching, list, lockedRef },
    actions: {
      search,
      lock: () => {
        lockedRef.current = true;
        setOpen(false);
      },
      unlock: () => {
        lockedRef.current = false;
      },
    },
  };
}




