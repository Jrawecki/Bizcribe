// src/utils/geocode.js

/**
 * Geocode a free-form address string using OpenStreetMap's Nominatim API.
 * Returns { lat: number, lng: number } or null if no match.
 */
const NOMINATIM_EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL;
const GEOCODE_PROXY = import.meta.env.VITE_GEOCODE_PROXY;

export async function geocode(address) {
  if (!address) return null;

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
  });
  const isProxy = Boolean(GEOCODE_PROXY);
  if (!isProxy && NOMINATIM_EMAIL) {
    // it's polite to include a contact email per Nominatim policy
    params.set('email', NOMINATIM_EMAIL);
  }

  const url = isProxy
    ? `${GEOCODE_PROXY}?${params.toString()}`
    : `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocode error: ${res.status} ${res.statusText}`);
  }

  const results = await res.json();
  if (!results.length) return null;

  const { lat, lon } = results[0];
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon)
  };
}
