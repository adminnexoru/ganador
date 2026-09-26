import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getPet } from '@/api/pets';
import { createZone, deleteZone, listZones, updateZone } from '@/api/zones';
import { PetMap, type MapPoint } from '@/components/pet-map';
import { Body, Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { useCachedLocation } from '@/hooks/use-cached-location';
import { useQuery } from '@/hooks/use-query';
import { colors, spacing } from '@/theme';

const RADII = [50, 100, 200, 500, 1000, 2000];

/** Zonas seguras (FR-012): se crean tocando el mapa; solo el dueño edita (FR-018). */
export default function ZonesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pet } = useQuery(() => getPet(id), [id]);
  const { data: zones, loading, reload } = useQuery(() => listZones(id), [id]);
  const { location } = useCachedLocation(id);
  const [center, setCenter] = useState<MapPoint | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const isOwner = pet?.role === 'owner';

  async function save() {
    if (!center) return;
    setError(null);
    try {
      await createZone(id, { name: name.trim(), centerLat: center.lat, centerLng: center.lng, radiusM: radius });
      setCenter(null);
      setName('');
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (loading || !pet) return <Loading />;
  const draft = center ? [{ id: 'nueva', centerLat: center.lat, centerLng: center.lng, radiusM: radius, active: true }] : [];

  return (
    <Screen>
      <PetMap
        position={location?.position ?? null}
        zones={[...(zones ?? []), ...draft]}
        onPress={isOwner ? setCenter : undefined}
      />
      {isOwner ? (
        center ? (
          <Card>
            <Field label={t('zones.name')} placeholder={t('zones.namePlaceholder')} maxLength={40} value={name} onChangeText={setName} />
            <Text style={s.label}>{t('zones.radius')}</Text>
            <View style={s.chips}>
              {RADII.map((r) => (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: radius === r }}
                  onPress={() => setRadius(r)}
                  style={[s.chip, radius === r && s.chipOn]}>
                  <Text style={[s.chipText, radius === r && s.chipTextOn]}>{t('zones.meters', { m: r })}</Text>
                </Pressable>
              ))}
            </View>
            <ErrorText>{error}</ErrorText>
            <Button label={t('zones.save')} onPress={save} disabled={name.trim().length === 0} />
            <Button label={t('common.cancel')} variant="secondary" onPress={() => setCenter(null)} />
          </Card>
        ) : (
          <Body muted>{t('zones.tapToCreate')}</Body>
        )
      ) : null}
      {zones?.length === 0 ? <Body muted>{t('zones.empty')}</Body> : null}
      {zones?.map((z) => (
        <Card key={z.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.zoneName}>{z.name}</Text>
            <Body muted>{t('zones.meters', { m: z.radiusM })}</Body>
          </View>
          {isOwner ? (
            <>
              <Switch
                accessibilityLabel={t('zones.active')}
                value={z.active}
                onValueChange={async (active) => {
                  await updateZone(z.id, { active });
                  await reload();
                }}
              />
              <Button
                label={t('common.delete')}
                variant="secondary"
                onPress={async () => {
                  await deleteZone(z.id);
                  await reload();
                }}
              />
            </>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  zoneName: { fontSize: 16, fontWeight: '600', color: colors.text },
});
