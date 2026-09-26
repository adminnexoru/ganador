import '@/i18n';

import { Stack } from 'expo-router';

/**
 * En web solo existen la página pública de la placa y el aviso de privacidad (research R2).
 * Este layout no carga sesión, almacenamiento seguro, mapas ni notificaciones, para mantener
 * ligera la página pública (research R3, principio V).
 */
export default function WebRootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
