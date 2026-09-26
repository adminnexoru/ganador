import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getPet } from '@/api/pets';
import { getPublicProfile, savePublicProfile } from '@/api/tags';
import type { Pet, PublicProfileSettings } from '@/api/types';
import { useSession } from '@/auth/session';
import { Body, Button, Card, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { colors, spacing } from '@/theme';

/** Qué datos muestra la página pública (FR-021); el botón de WhatsApp siempre aparece (FR-023). */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { data: pet } = useQuery(() => getPet(id), [id]);
  const { data: initial } = useQuery(() => getPublicProfile(id), [id]);
  if (!initial || !pet) return <Loading />;
  return <PublicProfileForm id={id} pet={pet} initial={initial} displayName={user?.displayName} />;
}

function PublicProfileForm({
  id,
  pet,
  initial,
  displayName,
}: {
  id: string;
  pet: Pet;
  initial: PublicProfileSettings;
  displayName?: string;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<PublicProfileSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (k: keyof PublicProfileSettings) => (value: boolean) => {
    setSaved(false);
    setV({ ...v, [k]: value });
  };

  async function save() {
    try {
      await savePublicProfile(id, v);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const rows: [keyof PublicProfileSettings, string][] = [
    ['showOwnerName', t('publicProfile.ownerName')],
    ['showConditions', t('publicProfile.conditions')],
    ['showMedications', t('publicProfile.medications')],
  ];
  const row = (k: keyof PublicProfileSettings, label: string) => (
    <View style={s.row} key={k}>
      <Text style={s.label}>{label}</Text>
      <Switch value={v[k]} onValueChange={toggle(k)} accessibilityLabel={label} />
    </View>
  );

  return (
    <Screen>
      <Title>{t('publicProfile.title')}</Title>
      <Body muted>{t('publicProfile.help')}</Body>
      <Card>
        {rows.map(([k, label]) => row(k, label))}
      </Card>
      <Title>{t('publicProfile.preview')}</Title>
      <Card>
        <Text style={s.petName}>{pet.name}</Text>
        {v.showOwnerName && displayName ? <Body>{t('public.owner', { name: displayName })}</Body> : null}
        {v.showConditions && pet.conditions ? <Body>{t('public.conditions', { text: pet.conditions })}</Body> : null}
        {v.showMedications && pet.medications ? <Body>{t('public.medications', { text: pet.medications })}</Body> : null}
        <View style={s.fakeButton}>
          <Text style={s.fakeButtonText}>{t('public.whatsapp')}</Text>
        </View>
        <Body muted>{t('publicProfile.whatsappFixed')}</Body>
      </Card>
      <ErrorText>{error}</ErrorText>
      {saved ? <Body muted>{t('publicProfile.saved')}</Body> : null}
      <Button label={t('common.save')} onPress={save} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  label: { fontSize: 16, color: colors.text, flex: 1 },
  petName: { fontSize: 22, fontWeight: '700', color: colors.text },
  fakeButton: {
    backgroundColor: colors.whatsapp,
    borderRadius: 12,
    padding: spacing(1.5),
    alignItems: 'center',
    marginTop: spacing(1),
  },
  fakeButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
