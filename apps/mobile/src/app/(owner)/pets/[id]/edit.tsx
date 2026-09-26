import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { absoluteUrl } from '@/api/config';
import { errorMessage } from '@/api/client';
import { deletePet, getPet, updatePet, uploadPhoto } from '@/api/pets';
import { PetForm } from '@/components/pet-form';
import { Button, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { OwnerOnly } from '@/components/owner-only';

function EditPetScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pet, error } = useQuery(() => getPet(id), [id]);

  if (!pet) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  function confirmDelete() {
    Alert.alert(t('pets.deleteTitle', { name: pet!.name }), t('pets.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePet(id);
          router.dismissAll();
        },
      },
    ]);
  }

  return (
    <Screen>
      <PetForm
        initial={pet}
        photoUrl={absoluteUrl(pet.photoUrl)}
        submitLabel={t('common.save')}
        onSubmit={async ({ photoUri, ...values }) => {
          try {
            await updatePet(id, values);
            if (photoUri) await uploadPhoto(id, photoUri);
            router.back();
          } catch (e) {
            throw new Error(errorMessage(e));
          }
        }}
      />
      <Button label={t('pets.delete')} variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

export default function EditPetScreenGuarded() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <OwnerOnly petId={id}>
      <EditPetScreen />
    </OwnerOnly>
  );
}
