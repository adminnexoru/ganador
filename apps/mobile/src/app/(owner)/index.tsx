import { Image } from 'expo-image';
import { Link, router, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { absoluteUrl } from '@/api/config';
import { listPets } from '@/api/pets';
import { ActivityBadge } from '@/components/activity-badge';
import { Body, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { colors, spacing } from '@/theme';

export default function PetsScreen() {
  const { t } = useTranslation();
  const { data: pets, error, loading } = useQuery(listPets, [], { refreshMs: 30_000 });
  const opened = useRef(false);

  // Con una sola mascota se abre directo su mapa (SC-001: ubicación en menos de 10 s).
  useEffect(() => {
    if (!opened.current && pets?.length === 1) {
      opened.current = true;
      router.push({ pathname: '/pets/[id]', params: { id: pets[0]!.id } });
    }
  }, [pets]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" accessibilityLabel={t('settings.title')} style={s.headerLink}>
              {t('settings.short')}
            </Link>
          ),
        }}
      />
      {loading && !pets ? <Loading /> : null}
      <ErrorText>{error}</ErrorText>
      {pets?.length === 0 ? <Body muted>{t('pets.empty')}</Body> : null}
      {pets?.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/pets/[id]', params: { id: p.id } })}>
          <Card style={s.row}>
            {p.photoUrl ? (
              <Image source={{ uri: absoluteUrl(p.photoUrl)! }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.placeholder]} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.name}>{p.name}</Text>
              {p.location ? <ActivityBadge location={p.location} /> : <Body muted>{t('pets.noDevice')}</Body>}
              {p.role === 'family' ? <Body muted>{t('pets.shared')}</Body> : null}
            </View>
          </Card>
        </Pressable>
      ))}
      <Button label={t('pets.add')} onPress={() => router.push('/pets/new')} />
      <Button label={t('invitations.title')} variant="secondary" onPress={() => router.push('/invitations')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  photo: { width: 56, height: 56, borderRadius: 28 },
  placeholder: { backgroundColor: colors.border },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerLink: { color: colors.primary, fontSize: 16 },
});
