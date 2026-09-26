import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/client';
import { acceptInvitation, listInvitations } from '@/api/family';
import { Body, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';

/** Invitaciones pendientes para el número del usuario (FR-017). */
export default function InvitationsScreen() {
  const { t } = useTranslation();
  const { data, loading, reload } = useQuery(listInvitations, []);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  return (
    <Screen>
      {data?.length === 0 ? <Body muted>{t('invitations.empty')}</Body> : null}
      {data?.map((inv) => (
        <Card key={inv.id}>
          <Body>{t('invitations.item', { pet: inv.petName, owner: inv.invitedBy || t('invitations.someone') })}</Body>
          <Button
            label={t('invitations.accept')}
            onPress={async () => {
              try {
                await acceptInvitation(inv.id);
                await reload();
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          />
        </Card>
      ))}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
