import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PetInput, PetSize, Species } from '@/api/types';
import { Button, ErrorText, Field } from '@/components/ui';
import { colors, spacing } from '@/theme';

export type PetFormValues = PetInput & { photoUri?: string | null };

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.choices}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === o.value }}
          onPress={() => onChange(o.value)}
          style={[s.choice, value === o.value && s.choiceOn]}>
          <Text style={[s.choiceText, value === o.value && s.choiceTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Formulario de alta y edición de mascota (FR-005). */
export function PetForm({
  initial,
  photoUrl,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<PetFormValues>;
  photoUrl?: string | null;
  submitLabel: string;
  onSubmit: (values: PetFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<PetFormValues>({
    name: initial?.name ?? '',
    species: initial?.species ?? 'dog',
    breed: initial?.breed ?? '',
    size: initial?.size ?? null,
    conditions: initial?.conditions ?? '',
    medications: initial?.medications ?? '',
    photoUri: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PetFormValues>(k: K, val: PetFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) set('photoUri', res.assets[0].uri);
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setSaving(false);
    }
  }

  const preview = v.photoUri ?? photoUrl;
  return (
    <View style={{ gap: spacing(2) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('pets.photo')} onPress={pickPhoto} style={s.photo}>
        {preview ? (
          <Image source={{ uri: preview }} style={s.photoImg} contentFit="cover" />
        ) : (
          <Text style={s.photoText}>{t('pets.addPhoto')}</Text>
        )}
      </Pressable>
      <Field label={t('pets.name')} value={v.name} maxLength={40} onChangeText={(x) => set('name', x)} />
      <Text style={s.label}>{t('pets.species')}</Text>
      <Choice<Species>
        value={v.species}
        onChange={(x) => set('species', x)}
        options={[
          { value: 'dog', label: t('pets.dog') },
          { value: 'cat', label: t('pets.cat') },
        ]}
      />
      <Field label={t('pets.breed')} value={v.breed ?? ''} maxLength={60} onChangeText={(x) => set('breed', x)} />
      <Text style={s.label}>{t('pets.size')}</Text>
      <Choice<PetSize>
        value={v.size}
        onChange={(x) => set('size', x)}
        options={[
          { value: 'small', label: t('pets.small') },
          { value: 'medium', label: t('pets.medium') },
          { value: 'large', label: t('pets.large') },
        ]}
      />
      <Field
        label={t('pets.conditions')}
        value={v.conditions ?? ''}
        maxLength={500}
        multiline
        onChangeText={(x) => set('conditions', x)}
      />
      <Field
        label={t('pets.medications')}
        value={v.medications ?? ''}
        maxLength={500}
        multiline
        onChangeText={(x) => set('medications', x)}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={submitLabel} onPress={submit} loading={saving} disabled={v.name.trim().length === 0} />
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  choices: { flexDirection: 'row', gap: spacing(1), flexWrap: 'wrap' },
  choice: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.text, fontSize: 15 },
  choiceTextOn: { color: '#FFFFFF', fontWeight: '600' },
  photo: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: 120, height: 120 },
  photoText: { color: colors.primary, fontWeight: '600', textAlign: 'center', padding: spacing(1) },
});
