import L from 'leaflet';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const MAPBOX_DEFAULT_STYLE = 'mapbox/light-v11';

export const MAPBOX_STYLES = {
  Light: 'mapbox/light-v11',
};

export const MAPBOX_ENABLED = Boolean(MAPBOX_TOKEN);

export function normalizeStylePath(styleId = MAPBOX_DEFAULT_STYLE) {
  const raw = (styleId || MAPBOX_DEFAULT_STYLE).replace(/^mapbox:\/\/styles\//, '').replace(/^\/+/, '');
  return raw.startsWith('styles/v1/') ? raw : `styles/v1/${raw}`;
}

export function mapboxStyleUrl(styleId = MAPBOX_DEFAULT_STYLE) {
  const base = styleId || MAPBOX_DEFAULT_STYLE;
  return base.startsWith('mapbox://styles/') ? base : `mapbox://styles/${base}`;
}

export function mapboxTileProps(styleId = MAPBOX_DEFAULT_STYLE, token = MAPBOX_TOKEN) {
  const baseProps = {
    url: null,
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 22,
    detectRetina: true,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
  };

  if (!token) {
    return baseProps;
  }

  const normalized = normalizeStylePath(styleId);
  return {
    ...baseProps,
    url: `https://api.mapbox.com/${normalized}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`,
  };
}

export function osmTileProps() {
  return {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    tileSize: 256,
    maxZoom: 19,
    detectRetina: true,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  };
}

export function createLeafletTileLayer(provider = 'mapbox', options = {}) {
  const tileOptions =
    provider === 'mapbox' && MAPBOX_ENABLED
      ? mapboxTileProps(options.styleId, options.token)
      : osmTileProps();

  if (!tileOptions.url) {
    const fallback = osmTileProps();
    return L.tileLayer(fallback.url, fallback);
  }

  return L.tileLayer(tileOptions.url, tileOptions);
}
