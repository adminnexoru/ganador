import { useTranslation } from 'react-i18next';

import { Body, Screen, Title } from '@/components/ui';

export default function PetsScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Title>{t('pets.title')}</Title>
      <Body muted>{t('pets.empty')}</Body>
    </Screen>
  );
}
