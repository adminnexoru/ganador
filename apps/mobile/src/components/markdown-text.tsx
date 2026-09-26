import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

/**
 * Renderizador mínimo para el aviso de privacidad: títulos, párrafos, listas y tablas
 * (las tablas se muestran como filas "Columna: valor").
 */
export function MarkdownText({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.split('\n');
  let header: string[] | null = null;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      header = null;
      return;
    }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) return;
      if (!header) {
        header = cells;
        return;
      }
      blocks.push(
        <View key={i} style={s.row}>
          {cells.map((c, j) => (
            <Text key={j} style={s.p}>
              <Text style={s.b}>{header![j]}: </Text>
              {strip(c)}
            </Text>
          ))}
        </View>,
      );
      return;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push(
        <Text key={i} accessibilityRole="header" style={h[1]!.length === 1 ? s.h1 : s.h2}>
          {strip(h[2]!)}
        </Text>,
      );
      return;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    blocks.push(
      <Text key={i} style={s.p}>
        {li ? '• ' : ''}
        {strip(li ? li[1]! : line)}
      </Text>,
    );
  });
  return <View style={{ gap: spacing(1) }}>{blocks}</View>;
}

const strip = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1');

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing(1) },
  p: { fontSize: 15, lineHeight: 21, color: colors.text },
  b: { fontWeight: '700' },
  row: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing(1), gap: 2 },
});
