import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { activateTag, disableTag, listTags, patchMe } from '@/api/tags';
import { useSession } from '@/auth/session';
import { Body, Button, Card, ErrorText, Field, Loading, Screen, Title } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { spacing } from '@/theme';
import { OwnerOnly } from '@/components/owner-only';

/** Vincular la placa NFC/QR escaneando su QR o escribiendo el código (FR-019). */
function TagScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, setUser } = useSession();
  const { data: tags, loading, reload } = useQuery(() => listTags(id), [id]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmedWhatsapp, setConfirmedWhatsapp] = useState(false);
  const needsWhatsappConfirm = !user?.whatsappConfirmed && !confirmedWhatsapp;

  async function activate(value: string) {
    setError(null);
    setSaving(true);
    try {
      if (needsWhatsappConfirm) return;
      await activateTag(id, value);
      setCode('');
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmWhatsapp() {
    try {
      setUser(await patchMe({ whatsappConfirmed: true }));
      setConfirmedWhatsapp(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function startScan() {
    if (!permission?.granted && !(await requestPermission()).granted) return;
    setScanning(true);
  }

  if (loading) return <Loading />;
  return (
    <Screen>
      <Title>{t('tag.title')}</Title>
      {tags?.map((tag) => (
        <Card key={tag.id}>
          <Body>{t('tag.active', { code: tag.code })}</Body>
          <Button
            label={t('tag.disable')}
            variant="danger"
            onPress={async () => {
              await disableTag(tag.id);
              await reload();
            }}
          />
        </Card>
      ))}
      <Card>
        <Body>{t('tag.whatsappNotice')}</Body>
      </Card>
      {needsWhatsappConfirm ? (
        <Card>
          <Body>{t('tag.confirmWhatsapp', { phone: user?.phone ?? '' })}</Body>
          <Button label={t('tag.confirmWhatsappYes')} variant="whatsapp" onPress={confirmWhatsapp} />
        </Card>
      ) : (
        <>
          {scanning ? (
            <View style={s.camera}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  setScanning(false);
                  void activate(data);
                }}
              />
            </View>
          ) : (
            <Button label={t('tag.scan')} onPress={startScan} loading={saving} />
          )}
          <Body muted>{t('tag.orType')}</Body>
          <Field
            label={t('tag.codeLabel')}
            placeholder={t('tag.codePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            value={code}
            onChangeText={setCode}
          />
          <Button label={t('tag.activate')} variant="secondary" onPress={() => activate(code)} disabled={code.length < 10} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const s = StyleSheet.create({
  camera: { height: 280, borderRadius: 12, overflow: 'hidden', marginVertical: spacing(1) },
});

export default function TagScreenGuarded() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <OwnerOnly petId={id}>
      <TagScreen />
    </OwnerOnly>
  );
}
