import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, errorMessage } from '@/api/client';
import type { VerifyResponse } from '@/api/types';
import { useSession } from '@/auth/session';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';

export default function CodeScreen() {
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setError(null);
    setLoading(true);
    try {
      const res = await api<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: { phone, code },
        auth: false,
      });
      await signIn(res, res.user, res.needsConsent);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api('/auth/otp', { method: 'POST', body: { phone }, auth: false });
      setInfo(t('auth.codeResent'));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>{t('auth.codeTitle')}</Title>
      <Body muted>{t('auth.codeHelp', { phone })}</Body>
      <Field
        label={t('auth.codeLabel')}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
      />
      <ErrorText>{error}</ErrorText>
      {info ? <Body muted>{info}</Body> : null}
      <Button label={t('auth.verify')} onPress={verify} loading={loading} disabled={code.length !== 6} />
      <Button label={t('auth.resend')} variant="secondary" onPress={resend} />
    </Screen>
  );
}
