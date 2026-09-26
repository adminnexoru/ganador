import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function ConsentLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: t('common.back') }}>
      <Stack.Screen name="aviso" options={{ title: t('privacy.title') }} />
      <Stack.Screen name="whatsapp" options={{ title: t('whatsapp.title') }} />
    </Stack>
  );
}
