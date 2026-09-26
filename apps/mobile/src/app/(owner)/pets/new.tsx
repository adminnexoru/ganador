import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/client';
import { createPet, uploadPhoto } from '@/api/pets';
import { PetForm } from '@/components/pet-form';
import { Screen } from '@/components/ui';

export default function NewPetScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <PetForm
        submitLabel={t('pets.create')}
        onSubmit={async ({ photoUri, ...values }) => {
          try {
            const pet = await createPet(values);
            if (photoUri) await uploadPhoto(pet.id, photoUri);
            router.replace({ pathname: '/pets/[id]/device', params: { id: pet.id } });
          } catch (e) {
            throw new Error(errorMessage(e));
          }
        }}
      />
    </Screen>
  );
}
