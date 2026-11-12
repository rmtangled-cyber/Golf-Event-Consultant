import { StyleSheet, Text, View } from 'react-native';
import { Card, Muted, SectionTitle, colors } from '@/components/ui.tsx';
import { awards } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';

/** 表彰の一覧（順位から自動で決まる賞＋ドラコン・ニアピン） */
export function AwardResults({ event, title = '表彰' }: { event: CompeEvent; title?: string }) {
  const results = awards(event);
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {results.length === 0 && <Muted>ホールアウトした参加者が出ると表示されます。</Muted>}
      {results.map((r, i) => (
        <View key={`${r.title}-${i}`} style={styles.row}>
          <Text style={styles.title}>{r.title}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{r.playerName}</Text>
            {r.detail ? <Muted>{r.detail}</Muted> : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** ドラコン・ニアピンの暫定トップだけ（プレー中に見せる） */
export function ProvisionalSpecials({ event }: { event: CompeEvent }) {
  if (event.specialAwards.length === 0) return null;
  const nameOf = (id?: string) => event.players.find((p) => p.id === id)?.name;
  return (
    <Card>
      <SectionTitle>ドラコン・ニアピン（暫定トップ）</SectionTitle>
      {[...event.specialAwards]
        .sort((a, b) => a.hole - b.hole)
        .map((a) => (
          <View key={a.id} style={styles.row}>
            <Text style={styles.title}>
              {a.kind === 'drive' ? 'ドラコン' : 'ニアピン'}（{a.hole}番）
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{nameOf(a.winnerPlayerId) ?? '—'}</Text>
              {a.note ? <Muted>{a.note}</Muted> : null}
            </View>
          </View>
        ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  title: { width: 112, fontWeight: '700', color: colors.primary },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
});
