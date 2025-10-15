import L from 'leaflet';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const MAPBOX_DEFAULT_STYLE = 'mapbox/navigation-night-v1';

export const MAPBOX_STYLES = {
  'Neon Night (Mapbox)': 'mapbox/navigation-night-v1',
  'Streets': 'mapbox/streets-v12',
  'Outdoors': 'mapbox/outdoors-v12',
  'Clean Light': 'mapbox/light-v11',
  'Modern Dark': 'mapbox/dark-v11',
  'Satellite Streets': 'mapbox/satellite-streets-v12',
};

export function normalizeStylePath(styleId) {
  return styleId.startsWith('styles/v1/') ? styleId : `styles/v1/${styleId}`;
}

export function mapboxTileProps(styleId = MAPBOX_DEFAULT_STYLE, token = MAPBOX_TOKEN) {
  const url = token
    ? `https://api.mapbox.com/${normalizeStylePath(styleId)}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`
    : null;
  return {
    url,
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 22,
    detectRetina: true,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
  };
}

export function osmTileProps() {
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
    maxZoom: 19,
    detectRetina: true,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  };
}

export function createLeafletTileLayer(provider = 'mapbox', options = {}) {
  const props = provider === 'mapbox' && MAPBOX_TOKEN ? mapboxTileProps(options.styleId) : osmTileProps();
  return L.tileLayer(props.url, props);
}
