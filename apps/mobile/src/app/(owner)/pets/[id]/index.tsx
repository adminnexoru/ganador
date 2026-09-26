import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { getPet } from '@/api/pets';
import { ActivityBadge } from '@/components/activity-badge';
import { PetMap } from '@/components/pet-map';
import { Body, Button, Card, Loading, Screen } from '@/components/ui';
import { useCachedLocation } from '@/hooks/use-cached-location';
import { useQuery } from '@/hooks/use-query';
import { formatDateTime, formatPercent, formatTime } from '@/i18n/format';
import { colors, spacing } from '@/theme';
import { reportTiming } from '@/telemetry/timings';

/** Mapa con la última ubicación, hora, batería y estado (FR-008, FR-009). */
export default function PetMapScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pet } = useQuery(() => getPet(id), [id]);
  const { location, offlineSince } = useCachedLocation(id);
  const isOwner = pet?.role === 'owner';

  useEffect(() => {
    if (location?.position) reportTiming('owner_map_visible');
  }, [location]);

  const go = (path: '/pets/[id]/history' | '/pets/[id]/zones' | '/pets/[id]/tag' | '/pets/[id]/public-profile' | '/pets/[id]/family' | '/pets/[id]/device' | '/pets/[id]/edit') =>
    router.push({ pathname: path, params: { id } });

  return (
    <Screen>
      <Stack.Screen options={{ title: pet?.name ?? '' }} />
      {location === undefined ? <Loading /> : null}
      {offlineSince ? (
        <Card style={{ backgroundColor: '#FFF4E5' }}>
          <Text style={s.offline}>{t('common.offline', { time: formatTime(offlineSince) })}</Text>
        </Card>
      ) : null}
      {location === null ? (
        <Card>
          <Body>{t('pets.noDevice')}</Body>
          {isOwner ? <Button label={t('device.link')} onPress={() => go('/pets/[id]/device')} /> : null}
        </Card>
      ) : null}
      {location ? (
        <>
          <PetMap position={location.position} accuracyM={location.position?.accuracyM} />
          <Card>
            <ActivityBadge location={location} />
            <View style={s.row}>
              {location.position ? (
                <Body muted>{t('location.updated', { time: formatDateTime(location.position.recordedAt) })}</Body>
              ) : (
                <Body muted>{t('location.waiting')}</Body>
              )}
              {location.battery ? (
                <Text style={[s.battery, location.battery.levelPct <= 20 && { color: colors.danger }]}>
                  {t('location.battery', { level: formatPercent(location.battery.levelPct) })}
                </Text>
              ) : null}
            </View>
          </Card>
        </>
      ) : null}
      <Button label={t('history.title')} variant="secondary" onPress={() => go('/pets/[id]/history')} />
      <Button label={t('zones.title')} variant="secondary" onPress={() => go('/pets/[id]/zones')} />
      {isOwner ? (
        <>
          <Button label={t('tag.title')} variant="secondary" onPress={() => go('/pets/[id]/tag')} />
          <Button label={t('publicProfile.title')} variant="secondary" onPress={() => go('/pets/[id]/public-profile')} />
          <Button label={t('family.title')} variant="secondary" onPress={() => go('/pets/[id]/family')} />
          <Button label={t('device.title')} variant="secondary" onPress={() => go('/pets/[id]/device')} />
          <Button label={t('pets.edit')} variant="secondary" onPress={() => go('/pets/[id]/edit')} />
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(1), flexWrap: 'wrap' },
  battery: { fontSize: 15, fontWeight: '600', color: colors.text },
  offline: { color: colors.warning, fontWeight: '600' },
});
