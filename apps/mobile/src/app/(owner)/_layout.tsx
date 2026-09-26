import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ title: t('pets.title') }} />
      <Stack.Screen name="pets/new" options={{ title: t('pets.add') }} />
      <Stack.Screen name="pets/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="pets/[id]/edit" options={{ title: t('pets.edit') }} />
      <Stack.Screen name="pets/[id]/device" options={{ title: t('device.title') }} />
      <Stack.Screen name="pets/[id]/history" options={{ title: t('history.title') }} />
      <Stack.Screen name="pets/[id]/zones" options={{ title: t('zones.title') }} />
      <Stack.Screen name="pets/[id]/tag" options={{ title: t('tag.title') }} />
      <Stack.Screen name="pets/[id]/public-profile" options={{ title: t('publicProfile.title') }} />
      <Stack.Screen name="pets/[id]/family" options={{ title: t('family.title') }} />
      <Stack.Screen name="invitations" options={{ title: t('invitations.title') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
    </Stack>
  );
}
