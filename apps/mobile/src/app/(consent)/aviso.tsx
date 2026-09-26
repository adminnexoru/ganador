import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, errorMessage } from '@/api/client';
import { fetchPrivacyNotice, type PrivacyNotice } from '@/api/public';
import { useSession } from '@/auth/session';
import { MarkdownText } from '@/components/markdown-text';
import { Button, ErrorText, Loading, Screen } from '@/components/ui';

/** Aviso de privacidad y consentimiento explícito antes de guardar datos (FR-002). */
export default function ConsentScreen() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPrivacyNotice().then(setNotice, () => setError(t('common.error')));
  }, [t]);

  async function accept() {
    if (!notice) return;
    setLoading(true);
    try {
      await api('/me/consent', { method: 'POST', body: { noticeVersion: notice.version } });
      router.push('/whatsapp');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (!notice && !error) return <Loading />;
  return (
    <Screen>
      {notice ? <MarkdownText source={notice.text} /> : null}
      <ErrorText>{error}</ErrorText>
      <Button label={t('privacy.accept')} onPress={accept} loading={loading} disabled={!notice} />
      <Button label={t('privacy.decline')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
