import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, errorMessage } from '@/api/client';
import type { User } from '@/api/types';
import { useSession } from '@/auth/session';
import { Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';

/** Aceptación expresa y opcional de las alertas por WhatsApp (FR-013a). */
export default function WhatsappOptInScreen() {
  const { t } = useTranslation();
  const { consentAccepted, setUser } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      setUser(await api<User>('/me', { method: 'PATCH', body: { whatsappAlertsEnabled: true } }));
      await consentAccepted();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>{t('whatsapp.title')}</Title>
      <Body>{t('whatsapp.explain')}</Body>
      <Card>
        <Body muted>{t('whatsapp.consentText')}</Body>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button label={t('whatsapp.accept')} variant="whatsapp" onPress={accept} loading={loading} />
      <Button label={t('whatsapp.skip')} variant="secondary" onPress={consentAccepted} />
    </Screen>
  );
}
