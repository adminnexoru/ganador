import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Loading, Screen } from '@/components/ui';
import { usePetRole } from '@/hooks/usePetRole';

/** Muestra el contenido solo al dueño; a un familiar le explica que no puede editar (FR-018). */
export function OwnerOnly({ petId, children }: { petId: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { canEdit, loading } = usePetRole(petId);
  if (loading) return <Loading />;
  if (!canEdit) {
    return (
      <Screen>
        <Body muted>{t('family.onlyOwnerEdit')}</Body>
      </Screen>
    );
  }
  return children;
}
