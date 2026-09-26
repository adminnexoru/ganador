import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { getTrack } from '@/api/family';
import { PetMap } from '@/components/pet-map';
import { Body, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { formatDay, formatTime } from '@/i18n/format';
import { colors, spacing } from '@/theme';

/** Fecha local YYYY-MM-DD. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Recorridos de los últimos 7 días (FR-010). */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Los últimos 7 días se calculan una vez al abrir la pantalla.
  const [days] = useState(() => Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 24 * 3600_000)));
  const [day, setDay] = useState(isoDay(days[0]!));
  const [selected, setSelected] = useState<number | null>(null);
  const { data: points, loading, error } = useQuery(() => getTrack(id, day), [id, day]);

  const point = selected !== null ? points?.[selected] : undefined;
  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
        {days.map((d) => {
          const value = isoDay(d);
          const on = value === day;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setDay(value);
                setSelected(null);
              }}
              style={[s.day, on && s.dayOn]}>
              <Text style={[s.dayText, on && s.dayTextOn]}>{formatDay(d)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? <Loading /> : null}
      <ErrorText>{error}</ErrorText>
      {points && points.length === 0 ? <Body muted>{t('history.empty')}</Body> : null}
      {points && points.length > 0 ? (
        <>
          <PetMap track={points} position={point ?? points[points.length - 1]} height={360} />
          <Card>
            <Body>{t('history.summary', { count: points.length, from: formatTime(points[0]!.recordedAt), to: formatTime(points[points.length - 1]!.recordedAt) })}</Body>
          </Card>
          {points.map((p, i) => (
            <Pressable key={p.recordedAt} accessibilityRole="button" onPress={() => setSelected(i)}>
              <Text style={[s.point, selected === i && s.pointOn]}>{t('history.point', { time: formatTime(p.recordedAt) })}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  days: { gap: spacing(1) },
  day: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.text, textTransform: 'capitalize' },
  dayTextOn: { color: '#FFFFFF', fontWeight: '600' },
  point: { paddingVertical: 6, color: colors.text, fontSize: 15 },
  pointOn: { color: colors.primary, fontWeight: '700' },
});
