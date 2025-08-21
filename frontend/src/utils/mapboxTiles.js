import L from 'leaflet';

export const MAPBOX_STYLES = {
  'Neon Night (Mapbox)': 'mapbox/navigation-night-v1',
  'Clean Light': 'mapbox/light-v11',
  'Modern Dark': 'mapbox/dark-v11',
  'Outdoors': 'mapbox/outdoors-v12',
  'Streets': 'mapbox/streets-v12',
  'Satellite Streets': 'mapbox/satellite-streets-v12',
};

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const normalizeStylePath = (styleId) =>
  styleId.startsWith('styles/v1/') ? styleId : `styles/v1/${styleId}`;

export const mapboxUrl = (styleId, token = MAPBOX_TOKEN) =>
  `https://api.mapbox.com/${normalizeStylePath(styleId)}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`;

export function createMapboxLayer(styleId, token = MAPBOX_TOKEN) {
  const url = mapboxUrl(styleId, token);
  return L.tileLayer(url, {
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 22,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    detectRetina: true,
  });
}
