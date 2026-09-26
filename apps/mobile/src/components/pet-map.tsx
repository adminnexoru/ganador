import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import { colors } from '@/theme';

export type MapPoint = { lat: number; lng: number };
export type MapZone = { id: string; centerLat: number; centerLng: number; radiusM: number; active: boolean };

/** Mapa nativo: Google Maps en Android y Apple Maps en iOS (research R12). */
export function PetMap({
  position,
  accuracyM,
  zones = [],
  track = [],
  onPress,
  height = 320,
}: {
  position?: MapPoint | null;
  accuracyM?: number | null;
  zones?: MapZone[];
  track?: MapPoint[];
  onPress?: (p: MapPoint) => void;
  height?: number;
}) {
  const center = position ?? track[0] ?? (zones[0] ? { lat: zones[0].centerLat, lng: zones[0].centerLng } : null);
  return (
    <MapView
      style={[styles.map, { height }]}
      region={
        center
          ? { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
          : { latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.2, longitudeDelta: 0.2 }
      }
      onPress={(e) => onPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}>
      {zones.map((z) => (
        <Circle
          key={z.id}
          center={{ latitude: z.centerLat, longitude: z.centerLng }}
          radius={z.radiusM}
          strokeColor={z.active ? colors.primary : colors.muted}
          fillColor={z.active ? 'rgba(32,138,239,0.12)' : 'rgba(91,102,112,0.08)'}
        />
      ))}
      {track.length > 1 ? (
        <Polyline coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.primary} strokeWidth={3} />
      ) : null}
      {position ? (
        <>
          {accuracyM ? (
            <Circle
              center={{ latitude: position.lat, longitude: position.lng }}
              radius={accuracyM}
              strokeColor="transparent"
              fillColor="rgba(32,138,239,0.15)"
            />
          ) : null}
          <Marker coordinate={{ latitude: position.lat, longitude: position.lng }} />
        </>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { width: '100%', borderRadius: 12 } });
