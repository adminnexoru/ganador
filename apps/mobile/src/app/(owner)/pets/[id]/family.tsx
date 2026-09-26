import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { invite, listAccess, revokeAccess } from '@/api/family';
import { Body, Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { usePetRole } from '@/hooks/usePetRole';
import { useQuery } from '@/hooks/use-query';
import { colors, spacing } from '@/theme';

/** Compartir la mascota con la familia (FR-017): invitar por celular, ver estado y revocar. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, loading: roleLoading } = usePetRole(id);
  const { data: accesses, loading, reload } = useQuery(() => (canEdit ? listAccess(id) : Promise.resolve([])), [id, canEdit]);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    try {
      await invite(id, phone.replace(/\D/g, ''));
      setPhone('');
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (roleLoading || loading) return <Loading />;
  if (!canEdit) {
    return (
      <Screen>
        <Body muted>{t('family.onlyOwner')}</Body>
      </Screen>
    );
  }
  return (
    <Screen>
      <Body muted>{t('family.help')}</Body>
      <Field
        label={t('family.phoneLabel')}
        placeholder={t('auth.phonePlaceholder')}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('family.invite')} onPress={send} disabled={phone.replace(/\D/g, '').length !== 10} />
      {accesses?.map((a) => (
        <Card key={a.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{a.displayName || a.phone}</Text>
            <Body muted>{t(a.role === 'owner' ? 'family.owner' : a.status === 'invited' ? 'family.invited' : 'family.active')}</Body>
          </View>
          {a.role === 'family' ? (
            <Button
              label={t('family.revoke')}
              variant="secondary"
              onPress={async () => {
                await revokeAccess(id, a.id);
                await reload();
              }}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
});
