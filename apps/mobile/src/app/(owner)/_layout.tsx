import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ title: t('pets.title') }} />
    </Stack>
  );
}
