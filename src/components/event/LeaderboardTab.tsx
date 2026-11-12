import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Muted, colors, formatToPar } from '@/components/ui.tsx';
import { leaderboard } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';

const COLUMNS = [
  { key: 'rank', label: '順位', width: 36 },
  { key: 'name', label: '名前', width: undefined },
  { key: 'out', label: 'OUT', width: 36 },
  { key: 'in', label: 'IN', width: 36 },
  { key: 'gross', label: 'グロス', width: 46 },
  { key: 'hc', label: 'HC', width: 42 },
  { key: 'net', label: 'ネット', width: 50 },
] as const;

export function LeaderboardTab({ event }: { event: CompeEvent }) {
  const rows = leaderboard(event);
  if (rows.length === 0) {
    return (
      <Card>
        <Muted>参加者を登録し、スコアを入力すると順位が表示されます。</Muted>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexGrow: 1 }}>
          <View style={[styles.row, styles.header]}>
            {COLUMNS.map((c) => (
              <Text key={c.key} style={[styles.cell, styles.headerText, c.width ? { width: c.width } : styles.nameCol, c.key === 'name' && styles.left]}>
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((r) => {
            const done = r.rank != null;
            const top = done && r.rank! <= 3;
            return (
              <View key={r.player.id} style={[styles.row, top && { backgroundColor: '#FBF6E6' }]}>
                <Text style={[styles.cell, { width: 36, fontWeight: '800', color: top ? colors.accent : colors.text }]}>
                  {done ? r.rank : '-'}
                </Text>
                <Text style={[styles.cell, styles.left, styles.nameCol, { fontWeight: '600' }]} numberOfLines={1}>
                  {r.player.name}
                </Text>
                {done ? (
                  <>
                    <Text style={[styles.cell, { width: 36 }]}>{r.out}</Text>
                    <Text style={[styles.cell, { width: 36 }]}>{r.in}</Text>
                    <Text style={[styles.cell, { width: 46, fontWeight: '700' }]}>{r.gross}</Text>
                    <Text style={[styles.cell, { width: 42 }]}>{r.handicap}</Text>
                    <Text style={[styles.cell, { width: 50, fontWeight: '800', color: colors.primary }]}>{r.net}</Text>
                  </>
                ) : (
                  <Text style={[styles.cell, styles.left, { width: 210, color: colors.muted }]}>
                    {r.thru === 0 ? '未スタート' : `プレー中 ${r.thru}H（${formatToPar(r.toPar)}）`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {event.handicapMethod === 'shin-peoria' && (
        <View style={{ padding: 12 }}>
          <Muted>新ペリア：ハンデはホールアウト後に確定します。同ネットはハンデの少ない方が上位。</Muted>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  header: { backgroundColor: colors.primarySoft },
  headerText: { fontWeight: '700', color: colors.primaryDark, fontSize: 12 },
  cell: { textAlign: 'center', fontSize: 14, color: colors.text },
  left: { textAlign: 'left', paddingHorizontal: 4 },
  nameCol: { flex: 1, minWidth: 80 },
});
