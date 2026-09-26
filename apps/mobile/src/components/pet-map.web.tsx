import type { MapPoint, MapZone } from './pet-map';

// En web la app del dueño no se usa (research R2); react-native-maps no existe en web.
export function PetMap(_props: {
  position?: MapPoint | null;
  accuracyM?: number | null;
  zones?: MapZone[];
  track?: MapPoint[];
  onPress?: (p: MapPoint) => void;
  height?: number;
}) {
  return null;
}
