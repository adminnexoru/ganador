import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { Location } from '@/api/types';
import { formatDateTime, formatTime } from '@/i18n/format';
import { colors, spacing } from '@/theme';

/** Estado del rastreador y desde cuándo (FR-009): en movimiento, en reposo o sin señal. */
export function ActivityBadge({ location }: { location: Location }) {
  const { t } = useTranslation();
  const since = location.activitySince ? formatTime(location.activitySince) : null;
  const map = {
    moving: { color: colors.success, text: t('location.moving') },
    resting: { color: colors.primary, text: since ? t('location.restingSince', { time: since }) : t('location.resting') },
    no_signal: { color: colors.danger, text: since ? t('location.noSignalSince', { time: since }) : t('location.noSignal') },
  } as const;
  const state = location.activity ? map[location.activity] : { color: colors.muted, text: t('location.waiting') };
  return (
    <View style={s.wrap}>
      <View style={[s.dot, { backgroundColor: state.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.text, { color: state.color }]}>{state.text}</Text>
        {location.stale && location.position ? (
          <Text style={s.warn}>{t('location.stale', { time: formatDateTime(location.position.recordedAt) })}</Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  dot: { width: 12, height: 12, borderRadius: 6 },
  text: { fontSize: 16, fontWeight: '600' },
  warn: { fontSize: 14, color: colors.warning, marginTop: 2 },
});
