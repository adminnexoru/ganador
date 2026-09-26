import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, errorMessage } from '@/api/client';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';

export default function PhoneScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const digits = phone.replace(/\D/g, '');

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await api('/auth/otp', { method: 'POST', body: { phone: digits }, auth: false });
      router.push({ pathname: '/code', params: { phone: digits } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>{t('auth.welcome')}</Title>
      <Body muted>{t('auth.phoneHelp')}</Body>
      <Field
        label={t('auth.phoneLabel')}
        placeholder={t('auth.phonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={14}
        value={phone}
        onChangeText={setPhone}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('auth.sendCode')} onPress={submit} loading={loading} disabled={digits.length !== 10} />
    </Screen>
  );
}
