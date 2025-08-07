// src/utils/geocode.js

/**
 * Geocode a free-form address string using OpenStreetMap’s Nominatim API.
 * Returns { lat: number, lng: number } or null if no match.
 */
export async function geocode(address) {
  if (!address) return null;

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    // it's polite to include an email per Nominatim policy
    email: 'youremail@yourdomain.com'
  });

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

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
