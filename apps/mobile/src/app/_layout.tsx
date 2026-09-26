import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { SessionProvider, useSession } from '@/auth/session';
import { usePushRegistration } from '@/notifications/register';
import { useNotificationNavigation } from '@/notifications/handlers';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { status } = useSession();
  const { t } = useTranslation();
  usePushRegistration(status === 'ready');
  useNotificationNavigation(status === 'ready');

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);
  if (status === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitle: t('common.back'),
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsConsent'}>
        <Stack.Screen name="(consent)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(owner)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="aviso-de-privacidad" options={{ title: t('privacy.title') }} />
      <Stack.Screen name="p/[code]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootStack />
    </SessionProvider>
  );
}
