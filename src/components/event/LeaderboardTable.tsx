import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Muted, colors, formatToPar } from '@/components/ui.tsx';
import { leaderboard } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';

/**
 * 順位表。gross = true のときはハンデを使わずグロスで並べる
 * （新ペリアで結果確定前の閲覧リンクなど、ハンデがまだ出せないとき）。
 */
export function LeaderboardTable({ event, gross, footnote }: { event: CompeEvent; gross?: boolean; footnote?: string }) {
  const rows = leaderboard(gross ? { ...event, handicapMethod: 'none' } : event);
  if (rows.length === 0) {
    return (
      <Card>
        <Muted>参加者が登録されると順位が表示されます。</Muted>
      </Card>
    );
  }
  const showNet = !gross && event.handicapMethod !== 'none';

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexGrow: 1 }}>
          <View style={[styles.row, styles.header]}>
            <Text style={[styles.cell, styles.headerText, { width: 36 }]}>順位</Text>
            <Text style={[styles.cell, styles.headerText, styles.left, styles.nameCol]}>名前</Text>
            <Text style={[styles.cell, styles.headerText, { width: 36 }]}>OUT</Text>
            <Text style={[styles.cell, styles.headerText, { width: 36 }]}>IN</Text>
            <Text style={[styles.cell, styles.headerText, { width: 46 }]}>グロス</Text>
            {showNet && <Text style={[styles.cell, styles.headerText, { width: 42 }]}>HC</Text>}
            {showNet && <Text style={[styles.cell, styles.headerText, { width: 50 }]}>ネット</Text>}
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
                    {showNet && <Text style={[styles.cell, { width: 42 }]}>{r.handicap}</Text>}
                    {showNet && (
                      <Text style={[styles.cell, { width: 50, fontWeight: '800', color: colors.primary }]}>{r.net}</Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.cell, styles.left, { width: showNet ? 210 : 118, color: colors.muted }]}>
                    {r.thru === 0 ? '未スタート' : `${r.thru}H（${formatToPar(r.toPar)}）`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {footnote ? (
        <View style={{ padding: 12 }}>
          <Muted>{footnote}</Muted>
        </View>
      ) : null}
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
