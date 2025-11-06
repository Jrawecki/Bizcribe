import L from 'leaflet';
import pinDropUrl from '../assets/pin_drop.png';

// Remove the old default icon behavior
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: pinDropUrl,
  iconUrl: pinDropUrl,
  shadowUrl: null,
});
