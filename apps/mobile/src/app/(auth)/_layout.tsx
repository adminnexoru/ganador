import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: t('common.back') }}>
      <Stack.Screen name="phone" options={{ title: t('auth.phoneTitle') }} />
      <Stack.Screen name="code" options={{ title: t('auth.codeTitle') }} />
    </Stack>
  );
}
