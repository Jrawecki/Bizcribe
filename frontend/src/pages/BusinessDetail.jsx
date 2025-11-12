import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import '../utils/mapIconSetup.js';

import { MAPBOX_TOKEN, MAPBOX_ENABLED, mapboxStyleUrl, osmTileProps } from '../utils/tiles.js';

mapboxgl.accessToken = MAPBOX_TOKEN || '';

const DEFAULT_CENTER = { lat: 39.7391, lng: -75.5398 };

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char),
  );

export default function BusinessDetail() {
  const { id } = useParams();
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapboxFailed, setMapboxFailed] = useState(!MAPBOX_ENABLED);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const popupRef = useRef(null);
  const leafletMapRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        if (mounted) setBiz(data);
      } catch {
        if (mounted) setError('Business not found');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const hasCoords = useMemo(
    () => biz && typeof biz.lat === 'number' && typeof biz.lng === 'number',
    [biz],
  );

  const mapCenter = hasCoords
    ? { lat: biz.lat, lng: biz.lng }
    : DEFAULT_CENTER;

  const zoomToLocation = useCallback(() => {
    if (!hasCoords || !biz) return;
    const coords = [biz.lng, biz.lat];
    const popupHtml = `<div class="map-popup"><div class="map-popup__title">${escapeHtml(biz.name)}</div></div>`;

    if (!mapboxFailed && MAPBOX_ENABLED && mapRef.current) {
      const map = mapRef.current;
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 15;
      const targetZoom = Math.min(18, Math.max(currentZoom, 17));
      const showPopup = () => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(map);
      };
      map.flyTo({
        center: coords,
        zoom: targetZoom,
        duration: 600,
        essential: true,
      });
      map.once('moveend', showPopup);
      if (!(typeof map.isMoving === 'function' ? map.isMoving() : false)) {
        showPopup();
      }
      return;
    }

    if (leafletMapRef.current) {
      const map = leafletMapRef.current;
      const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 19;
      const targetZoom = Math.min(maxZoom, 18);
      map.flyTo([biz.lat, biz.lng], targetZoom, { duration: 0.6 });
      const showLeafletPopup = () => {
        L.popup({ offset: [0, -12] })
          .setLatLng([biz.lat, biz.lng])
          .setContent(popupHtml)
          .openOn(map);
      };
      map.once('moveend', showLeafletPopup);
      if (!(map._animatingZoom || (map._panAnim && map._panAnim.running))) {
        showLeafletPopup();
      }
    }
  }, [hasCoords, mapboxFailed, biz]);

  useEffect(() => {
    if (!hasCoords || mapboxFailed || !MAPBOX_ENABLED) return;
    if (mapRef.current || !mapContainerRef.current) return;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapboxStyleUrl(),
        center: [mapCenter.lng, mapCenter.lat],
        zoom: 15,
        attributionControl: false,
      });

      mapRef.current = map;
      leafletMapRef.current = null;

      map.on('load', () => {
        map.resize();
        markerRef.current = new mapboxgl.Marker({ color: '#3b5f7c' })
          .setLngLat([mapCenter.lng, mapCenter.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
              `<div class="map-popup"><div class="map-popup__title">${escapeHtml(biz.name)}</div></div>`,
            ),
          )
          .addTo(map);
        zoomToLocation();
      });

      map.on('error', (event) => {
        console.warn('Business detail map error', event?.error || event);
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        setMapboxFailed(true);
      });

      return () => {
        markerRef.current?.remove();
        markerRef.current = null;
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        mapRef.current = null;
        map.remove();
      };
    } catch (err) {
      console.warn('Failed to initialise Mapbox map for business detail', err);
      setMapboxFailed(true);
    }
  }, [biz, hasCoords, mapCenter.lat, mapCenter.lng, mapboxFailed, zoomToLocation]);

  useEffect(() => {
    if (!hasCoords || mapboxFailed || !MAPBOX_ENABLED) return;
    if (!mapRef.current) return;
    markerRef.current?.setLngLat([biz.lng, biz.lat]).addTo(mapRef.current);
    zoomToLocation();
  }, [hasCoords, biz?.lat, biz?.lng, mapboxFailed, zoomToLocation]);

  useEffect(() => {
    if (!hasCoords || !mapboxFailed) return;
    if (leafletMapRef.current) {
      zoomToLocation();
    }
  }, [hasCoords, mapboxFailed, biz?.lat, biz?.lng, zoomToLocation]);

  useEffect(() => {
    if (mapboxFailed && popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [mapboxFailed]);



  const tileProps = useMemo(() => osmTileProps(), []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error || !biz) return <div className="p-6">{error || 'Error'}</div>;

  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.location || biz.address1 || biz.name)}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/" className="underline">Back</Link>
      <h1 className="text-3xl font-bold mt-2">{biz.name}</h1>
      <div className="opacity-80 mt-1">{biz.location}</div>
      {biz.phone_number && <div className="mt-1">Phone: {biz.phone_number}</div>}
      {biz.description && <p className="mt-4">{biz.description}</p>}

      <div className="mt-6 rounded-xl overflow-hidden relative" style={{ height: 360 }}>
        {!mapboxFailed && MAPBOX_ENABLED && hasCoords ? (
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        ) : (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={hasCoords ? 15 : 12}
            style={{ height: '100%', width: '100%' }}
            attributionControl={false}
            whenCreated={(map) => {
              leafletMapRef.current = map;
              if (hasCoords) {
                setTimeout(() => zoomToLocation(), 50);
              }
            }}
          >
            <TileLayer
              url={tileProps.url}
              attribution={tileProps.attribution}
              tileSize={tileProps.tileSize}
              maxZoom={tileProps.maxZoom}
              detectRetina={tileProps.detectRetina}
            />
            {hasCoords && (
              <Marker position={[biz.lat, biz.lng]}>
                <Popup>{biz.name}</Popup>
              </Marker>
            )}
          </MapContainer>
        )}
        {mapboxFailed && MAPBOX_ENABLED && (
          <div className="absolute top-3 left-3 z-10 rounded-lg bg-black/65 backdrop-blur px-3 py-2 text-xs text-white/85 pointer-events-none">
            Mapbox unavailable - using fallback tiles.
          </div>
        )}
        {hasCoords && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              type="button"
              onClick={zoomToLocation}
              className="btn btn-ghost bg-black/40 hover:bg-black/60 text-sm rounded-xl px-3 py-2"
            >
              Zoom to location
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full btn-primary">Directions</a>
      </div>
    </div>
  );
}
