import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Muted, SectionTitle, colors, formatToPar } from '@/components/ui.tsx';
import { holesPlayed, sum } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';
import { HOLE_COUNT } from '@/domain/types.ts';

export function ScoresTab({ event }: { event: CompeEvent }) {
  if (event.players.length === 0) {
    return (
      <Card>
        <Muted>先に「参加者」タブで参加者を登録してください。</Muted>
      </Card>
    );
  }

  const groups = new Map<number, typeof event.players>();
  for (const p of event.players) {
    const g = p.group ?? 1;
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }

  return (
    <View style={{ gap: 12 }}>
      {[...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([group, players]) => (
          <Card key={group}>
            <SectionTitle>{group}組</SectionTitle>
            {players.map((p) => {
              const strokes = event.scores[p.id] ?? [];
              const thru = holesPlayed(strokes);
              const toPar = strokes.reduce<number>(
                (acc, s, i) => (s == null ? acc : acc + s - event.pars[i]),
                0,
              );
              return (
                <Link
                  key={p.id}
                  href={{ pathname: '/events/[id]/score/[playerId]', params: { id: event.id, playerId: p.id } }}
                  asChild
                >
                  <Pressable style={styles.row}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>
                      {thru === 0
                        ? '未入力'
                        : thru === HOLE_COUNT
                          ? `ホールアウト ${sum(strokes)}`
                          : `${thru}H ${formatToPar(toPar)}`}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </Link>
              );
            })}
          </Card>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
  chevron: { fontSize: 22, color: colors.muted },
});
