import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { Button, colors } from '@/components/ui.tsx';
import { awards, leaderboard, sum } from '@/domain/scoring.ts';
import { useLoader } from '@/hooks/useLoader.ts';

const PRINT_CSS = `
html, body { height: auto !important; overflow: visible !important; }
#root { display: block !important; height: auto !important; }
@media print {
  #print-actions { display: none !important; }
  @page { size: A4 landscape; margin: 10mm; }
}`;

/** 印刷用の順位表（ブラウザの印刷から PDF にも保存できる） */
export default function PrintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: bundle } = useLoader(() => api.getEvent(id), [id]);

  // 画面全体をスクロール・印刷できるようにする（このページの間だけ）
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  if (!bundle) return null;
  const event = toCompeEvent(bundle);
  const rows = leaderboard(event);
  const results = awards(event);
  const showNet = event.handicapMethod !== 'none';
  const holes = Array.from({ length: 18 }, (_, i) => i);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View nativeID="print-actions" style={styles.actions}>
        <Button title="← 戻る" variant="secondary" onPress={() => router.back()} />
        <Button title="印刷・PDFに保存" onPress={() => (globalThis as any).print?.()} />
      </View>

      <Text style={styles.title}>{event.name}</Text>
      <Text style={styles.sub}>
        {event.date}　{event.courseName}　{bundle.event.status === 'final' ? '' : '（結果確定前）'}
      </Text>

      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.cell, styles.rank]}>順位</Text>
          <Text style={[styles.cell, styles.name]}>名前</Text>
          {holes.map((i) => (
            <Text key={i} style={[styles.cell, styles.hole]}>
              {i + 1}
            </Text>
          ))}
          <Text style={[styles.cell, styles.num]}>OUT</Text>
          <Text style={[styles.cell, styles.num]}>IN</Text>
          <Text style={[styles.cell, styles.num]}>計</Text>
          {showNet && <Text style={[styles.cell, styles.num]}>HC</Text>}
          {showNet && <Text style={[styles.cell, styles.num]}>ネット</Text>}
        </View>
        <View style={[styles.tr, styles.parRow]}>
          <Text style={[styles.cell, styles.rank]} />
          <Text style={[styles.cell, styles.name]}>パー</Text>
          {holes.map((i) => (
            <Text key={i} style={[styles.cell, styles.hole]}>
              {event.pars[i]}
            </Text>
          ))}
          <Text style={[styles.cell, styles.num]}>{sum(event.pars.slice(0, 9))}</Text>
          <Text style={[styles.cell, styles.num]}>{sum(event.pars.slice(9))}</Text>
          <Text style={[styles.cell, styles.num]}>{sum(event.pars)}</Text>
          {showNet && <Text style={[styles.cell, styles.num]} />}
          {showNet && <Text style={[styles.cell, styles.num]} />}
        </View>
        {rows.map((r) => {
          const strokes = event.scores[r.player.id] ?? [];
          return (
            <View key={r.player.id} style={styles.tr}>
              <Text style={[styles.cell, styles.rank, styles.bold]}>{r.rank ?? '-'}</Text>
              <Text style={[styles.cell, styles.name, styles.bold]} numberOfLines={1}>
                {r.player.name}
              </Text>
              {holes.map((i) => (
                <Text key={i} style={[styles.cell, styles.hole]}>
                  {strokes[i] ?? ''}
                </Text>
              ))}
              <Text style={[styles.cell, styles.num]}>{r.thru ? r.out : ''}</Text>
              <Text style={[styles.cell, styles.num]}>{r.thru ? r.in : ''}</Text>
              <Text style={[styles.cell, styles.num, styles.bold]}>{r.thru ? r.gross : ''}</Text>
              {showNet && <Text style={[styles.cell, styles.num]}>{r.handicap ?? ''}</Text>}
              {showNet && <Text style={[styles.cell, styles.num, styles.bold]}>{r.net ?? ''}</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.h2}>表彰</Text>
      <View style={styles.awards}>
        {results.map((a, i) => (
          <Text key={i} style={styles.award}>
            <Text style={styles.bold}>{a.title}</Text>　{a.playerName}
            {a.detail ? `（${a.detail}）` : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#fff', padding: 24, gap: 8, minHeight: '100%' },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  table: { borderWidth: 1, borderColor: '#999', marginTop: 8 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  th: { backgroundColor: '#EEF3EF' },
  parRow: { backgroundColor: '#F7F9F7' },
  cell: { fontSize: 11, paddingVertical: 4, paddingHorizontal: 2, textAlign: 'center', color: colors.text, fontVariant: ['tabular-nums'] },
  rank: { width: 32 },
  name: { width: 110, textAlign: 'left' },
  hole: { width: 24 },
  num: { width: 38 },
  bold: { fontWeight: '700' },
  h2: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 12 },
  awards: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, columnGap: 24 },
  award: { fontSize: 13, color: colors.text },
});
