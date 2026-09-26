import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/client';
import { getDevice, linkDevice, unlinkDevice } from '@/api/pets';
import { Body, Button, Card, ErrorText, Field, Loading, Screen, Title } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { OwnerOnly } from '@/components/owner-only';

/** Vincular el rastreador con su IMEI o el identificador de Traccar Client (FR-006). */
function DeviceScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: device, loading, reload } = useQuery(() => getDevice(id), [id]);
  const [externalId, setExternalId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function link() {
    setError(null);
    setSaving(true);
    try {
      await linkDevice(id, externalId.trim());
      router.replace({ pathname: '/pets/[id]', params: { id } });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  async function unlink() {
    await unlinkDevice(id);
    await reload();
  }

  if (loading) return <Loading />;
  return (
    <Screen>
      <Title>{t('device.title')}</Title>
      {device ? (
        <Card>
          <Body>{t('device.linked', { id: device.externalId })}</Body>
          <Button label={t('device.unlink')} variant="danger" onPress={unlink} />
        </Card>
      ) : (
        <>
          <Body muted>{t('device.help')}</Body>
          <Field
            label={t('device.idLabel')}
            placeholder={t('device.idPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            value={externalId}
            onChangeText={setExternalId}
          />
          <ErrorText>{error}</ErrorText>
          <Button label={t('device.link')} onPress={link} loading={saving} disabled={externalId.trim().length < 3} />
          <Button
            label={t('device.later')}
            variant="secondary"
            onPress={() => router.replace({ pathname: '/pets/[id]', params: { id } })}
          />
        </>
      )}
    </Screen>
  );
}

export default function DeviceScreenGuarded() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <OwnerOnly petId={id}>
      <DeviceScreen />
    </OwnerOnly>
  );
}
