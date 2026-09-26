import type { ConfigContext, ExpoConfig } from 'expo/config';

// Agrega la clave de Google Maps (Android) desde el entorno para no guardarla en app.json.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY }],
  ],
});
