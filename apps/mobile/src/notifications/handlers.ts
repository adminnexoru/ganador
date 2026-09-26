import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** Al tocar una alerta se abre el mapa de la mascota (data.petId). */
export function useNotificationNavigation(enabled: boolean) {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!enabled) return;
    const petId = last?.notification.request.content.data?.petId;
    if (typeof petId === 'string') router.push({ pathname: '/pets/[id]', params: { id: petId } });
  }, [enabled, last]);
}
