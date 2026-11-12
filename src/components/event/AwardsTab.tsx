import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import type { AwardInfo } from '@/api/types.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { AwardResults } from '@/components/event/AwardResults.tsx';
import { Button, Card, Chip, CommitField, Muted, SectionTitle, Stepper, colors } from '@/components/ui.tsx';
import type { OrganizerTabProps } from './types.ts';

export function AwardsTab({ bundle, run }: OrganizerTabProps) {
  const { event, awards, players } = bundle;

  const addSpecial = (kind: AwardInfo['kind']) => {
    const used = new Set(awards.map((a) => a.hole));
    // ドラコンは空いているパー5（なければパー4）、ニアピンはパー3
    const candidates = event.pars
      .map((par, i) => ({ par, hole: i + 1 }))
      .filter(({ par }) => (kind === 'pin' ? par === 3 : par >= 4))
      .sort((a, b) => b.par - a.par);
    const hole = candidates.find((c) => !used.has(c.hole))?.hole ?? 1;
    void run(() => api.addAward(event.id, kind, hole));
  };

  return (
    <View style={{ gap: 12 }}>
      <AwardResults event={toCompeEvent(bundle)} />
      <Card>
        <SectionTitle>ドラコン・ニアピン</SectionTitle>
        <Muted>対象ホールを決めておくと、組代表がプレー中に暫定トップを記録できます。</Muted>
        {awards.map((a) => (
          <View key={a.id} style={styles.special}>
            <View style={styles.inline}>
              <Text style={styles.kind}>{a.kind === 'drive' ? 'ドラコン' : 'ニアピン'}</Text>
              <Stepper
                label="ホール"
                value={a.hole}
                min={1}
                max={18}
                onChange={(hole) => run(() => api.updateAward(a.id, { hole }))}
              />
              <Muted>番（Par {event.pars[a.hole - 1]}）</Muted>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => run(() => api.deleteAward(a.id))} hitSlop={8} accessibilityLabel="削除">
                <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {players.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={a.winnerPlayerId === p.id}
                  onPress={() =>
                    run(() => api.updateAward(a.id, { winnerPlayerId: a.winnerPlayerId === p.id ? null : p.id }))
                  }
                />
              ))}
            </View>
            {a.kind === 'pin' && (
              <CommitField
                value={a.note}
                onCommit={(note) => run(() => api.updateAward(a.id, { note }))}
                placeholder="メモ（任意・例：1.2m）"
                style={styles.note}
              />
            )}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="＋ ドラコン" variant="secondary" onPress={() => addSpecial('drive')} style={{ flex: 1 }} />
          <Button title="＋ ニアピン" variant="secondary" onPress={() => addSpecial('pin')} style={{ flex: 1 }} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  special: {
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kind: { fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.text,
  },
});
