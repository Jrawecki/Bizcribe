import { useCallback, useRef, useState } from 'react';

const WILMINGTON_CENTER = { lat: 39.7391, lng: -75.5398 };
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const endpointBase = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const debounce = (fn, ms=250) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export function useAddressSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [list, setList] = useState([]);
  const lockedRef = useRef(false);

  const parse = (f) => {
    const [lng, lat] = f.center || [null, null];
    const label = f.place_name || '';
    const ctx = f.context || [];
    const byId = (p) => ctx.find(c => (c.id||'').startsWith(p));
    const place = byId('place');
    const region = byId('region');
    const postcode = byId('postcode');
    const address = f.place_type?.includes('address') ? [f.address, f.text].filter(Boolean).join(' ')
                   : f.place_type?.includes('poi')     ? (f.text || '') : '';
    return {
      label, lat, lng,
      address: {
        line1: address,
        city:  place?.text || '',
        state: region?.short_code ? region.short_code.replace('US-','') : (region?.text || ''),
        zip:   postcode?.text || ''
      }
    };
  };

  const search = useCallback(debounce(async (q) => {
    if (!q || q.trim().length < 3 || lockedRef.current) { setList([]); return; }
    try {
      setFetching(true);
      const url = new URL(`${endpointBase}/${encodeURIComponent(q.trim())}.json`);
      url.searchParams.set('access_token', MAPBOX_TOKEN);
      url.searchParams.set('autocomplete','true');
      url.searchParams.set('country','US');
      url.searchParams.set('proximity', `${WILMINGTON_CENTER.lng},${WILMINGTON_CENTER.lat}`);
      url.searchParams.set('limit','8');
      url.searchParams.set('types','address,place,postcode,poi');
      const res = await fetch(url.toString(), { headers: {'Accept-Language':'en-US'} });
      const data = await res.json();
      setList((data.features||[]).map(parse));
      setOpen(true);
    } finally { setFetching(false); }
  }, 250), []);

  return {
    state: { query, setQuery, open, setOpen, fetching, list, lockedRef },
    actions: {
      search,
      lock: () => { lockedRef.current = true; setOpen(false); },
      unlock: () => { lockedRef.current = false; },
    }
  };
}
