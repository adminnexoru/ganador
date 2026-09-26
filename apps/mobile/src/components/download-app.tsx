import { useTranslation } from 'react-i18next';

import { Body, Screen, Title } from '@/components/ui';

/** En web, las pantallas del dueño invitan a usar la app (research R2). */
export function DownloadApp() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Title>{t('web.downloadTitle')}</Title>
      <Body>{t('web.downloadBody')}</Body>
    </Screen>
  );
}
