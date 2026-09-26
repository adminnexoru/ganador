import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { api, errorMessage } from '@/api/client';
import { patchMe } from '@/api/tags';
import { useSession } from '@/auth/session';
import { Body, Button, Card, ErrorText, Field, Screen, Title } from '@/components/ui';
import { colors } from '@/theme';

/** Ajustes: alertas por WhatsApp, derechos ARCO (FR-003a) y cuenta. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, setUser, signOut } = useSession();
  const [name, setName] = useState(user?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function toggleWhatsapp(value: boolean) {
    if (!value) return run(async () => setUser(await patchMe({ whatsappAlertsEnabled: false })));
    // Aceptación expresa (FR-013a): se muestra el texto antes de activar.
    Alert.alert(t('whatsapp.title'), t('whatsapp.consentText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('whatsapp.accept'),
        onPress: () => void run(async () => setUser(await patchMe({ whatsappAlertsEnabled: true }))),
      },
    ]);
  }

  async function exportData() {
    await run(async () => {
      const data = await api<unknown>('/me/export');
      await Share.share({ title: t('settings.exportTitle'), message: JSON.stringify(data, null, 2) });
    });
  }

  function confirmDelete() {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await api('/me', { method: 'DELETE' });
            await signOut();
          }),
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Field label={t('settings.name')} value={name} maxLength={60} onChangeText={setName} />
        <Button
          label={t('common.save')}
          variant="secondary"
          disabled={name.trim().length === 0}
          onPress={() =>
            void run(async () => {
              setUser(await patchMe({ displayName: name.trim() }));
              setInfo(t('settings.saved'));
            })
          }
        />
      </Card>
      <Card>
        <View style={s.row}>
          <Text style={s.label}>{t('settings.whatsappAlerts')}</Text>
          <Switch
            accessibilityLabel={t('settings.whatsappAlerts')}
            value={user?.whatsappAlertsEnabled ?? false}
            onValueChange={toggleWhatsapp}
          />
        </View>
        <Body muted>{t('settings.whatsappHelp')}</Body>
      </Card>
      <Title>{t('settings.privacy')}</Title>
      <Button label={t('settings.export')} variant="secondary" onPress={exportData} />
      <Button label={t('settings.logout')} variant="secondary" onPress={signOut} />
      <Button label={t('settings.delete')} variant="danger" onPress={confirmDelete} />
      <ErrorText>{error}</ErrorText>
      {info ? <Body muted>{info}</Body> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  label: { fontSize: 16, color: colors.text, flex: 1 },
});
