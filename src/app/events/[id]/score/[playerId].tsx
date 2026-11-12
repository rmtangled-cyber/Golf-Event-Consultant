import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, colors, formatToPar, strokeColor } from '@/components/ui.tsx';
import { sum } from '@/domain/scoring.ts';
import { HOLE_COUNT } from '@/domain/types.ts';
import { useEvent } from '@/store/EventsContext.tsx';

const SCORE_NAMES: Record<number, string> = {
  [-3]: 'アルバトロス',
  [-2]: 'イーグル',
  [-1]: 'バーディー',
  0: 'パー',
  1: 'ボギー',
  2: 'ダブルボギー',
  3: 'トリプルボギー',
};

export default function ScoreEntryScreen() {
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const { event, setStroke } = useEvent(id);
  const player = event?.players.find((p) => p.id === playerId);
  const strokes = (event && player && event.scores[player.id]) || Array<number | null>(HOLE_COUNT).fill(null);
  const firstEmpty = strokes.findIndex((s) => s == null);
  const [hole, setHole] = useState(firstEmpty === -1 ? 0 : firstEmpty);

  if (!event || !player) {
    return (
      <Screen style={{ padding: 16 }}>
        <Card>
          <Muted>参加者が見つかりません。</Muted>
        </Card>
      </Screen>
    );
  }

  const par = event.pars[hole];
  const current = strokes[hole];
  const shown = current ?? par;
  const diff = shown - par;

  const set = (value: number | null) => setStroke(player.id, hole, value);
  const toPar = strokes.reduce<number>((acc, s, i) => (s == null ? acc : acc + s - event.pars[i]), 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${player.name} のスコア` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ alignItems: 'center' }}>
          <Text style={styles.holeLabel}>
            {hole + 1}番ホール　Par {par}
          </Text>
          <View style={styles.entry}>
            <Pressable
              accessibilityLabel="1打減らす"
              onPress={() => set(Math.max(1, shown - 1))}
              style={styles.bigBtn}
            >
              <Text style={styles.bigBtnText}>−</Text>
            </Pressable>
            <View style={{ alignItems: 'center', minWidth: 96 }}>
              <Text style={[styles.strokes, { color: current == null ? colors.border : strokeColor(current, par) }]}>
                {shown}
              </Text>
              <Text style={styles.scoreName}>
                {current == null ? '未入力' : (SCORE_NAMES[diff] ?? formatToPar(diff))}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="1打増やす"
              onPress={() => set(Math.min(par * 4, shown + 1))}
              style={styles.bigBtn}
            >
              <Text style={styles.bigBtnText}>＋</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
            <Button
              title="← 前"
              variant="secondary"
              disabled={hole === 0}
              onPress={() => setHole(hole - 1)}
              style={{ flex: 1 }}
            />
            <Button
              title={hole === HOLE_COUNT - 1 ? '確定' : current == null ? `${shown}で確定して次へ` : '次へ →'}
              onPress={() => {
                if (current == null) set(shown);
                if (hole < HOLE_COUNT - 1) setHole(hole + 1);
              }}
              style={{ flex: 2 }}
            />
          </View>
          {current != null && (
            <Button title="このホールをクリア" variant="ghost" onPress={() => set(null)} />
          )}
        </Card>

        <Card>
          <View style={styles.summary}>
            <Summary label="OUT" value={sum(strokes.slice(0, 9))} />
            <Summary label="IN" value={sum(strokes.slice(9))} />
            <Summary label="TOTAL" value={sum(strokes)} />
            <Summary label="±" value={formatToPar(toPar)} />
          </View>
          {[0, 9].map((start) => (
            <View key={start} style={styles.grid}>
              {strokes.slice(start, start + 9).map((s, i) => {
                const index = start + i;
                const selected = index === hole;
                return (
                  <Pressable
                    key={index}
                    onPress={() => setHole(index)}
                    style={[styles.cell, selected && styles.cellSelected]}
                  >
                    <Text style={styles.cellHole}>{index + 1}</Text>
                    <Text style={[styles.cellValue, { color: strokeColor(s, event.pars[index]) }]}>{s ?? '·'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Muted>{label}</Muted>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  holeLabel: { fontSize: 18, fontWeight: '700', color: colors.primary },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 8 },
  bigBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnText: { fontSize: 36, fontWeight: '700', color: colors.primaryDark },
  strokes: { fontSize: 64, fontWeight: '800' },
  scoreName: { fontSize: 13, color: colors.muted },
  summary: { flexDirection: 'row' },
  grid: { flexDirection: 'row', gap: 4 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  cellHole: { fontSize: 10, color: colors.muted },
  cellValue: { fontSize: 16, fontWeight: '700' },
});
