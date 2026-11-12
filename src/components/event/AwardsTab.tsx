import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stepper } from '@/components/event/PlayersTab.tsx';
import { Button, Card, Muted, SectionTitle, colors } from '@/components/ui.tsx';
import { awards } from '@/domain/scoring.ts';
import type { CompeEvent, SpecialAward, SpecialAwardKind } from '@/domain/types.ts';
import { newId } from '@/store/EventsContext.tsx';

export function AwardsTab({
  event,
  update,
}: {
  event: CompeEvent;
  update: (fn: (e: CompeEvent) => CompeEvent) => void;
}) {
  const results = awards(event);

  const addSpecial = (kind: SpecialAwardKind) =>
    update((e) => {
      const used = new Set(e.specialAwards.map((a) => a.hole));
      // ドラコンは最初の空いているパー5（なければパー4）、ニアピンはパー3
      const candidates = e.pars
        .map((par, i) => ({ par, hole: i + 1 }))
        .filter(({ par }) => (kind === 'pin' ? par === 3 : par >= 4))
        .sort((a, b) => b.par - a.par);
      const hole = candidates.find((c) => !used.has(c.hole))?.hole ?? 1;
      return { ...e, specialAwards: [...e.specialAwards, { id: newId(), kind, hole }] };
    });

  const patch = (id: string, p: Partial<SpecialAward>) =>
    update((e) => ({
      ...e,
      specialAwards: e.specialAwards.map((a) => (a.id === id ? { ...a, ...p } : a)),
    }));

  const remove = (id: string) =>
    update((e) => ({ ...e, specialAwards: e.specialAwards.filter((a) => a.id !== id) }));

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>表彰</SectionTitle>
        {results.length === 0 && <Muted>ホールアウトした参加者が出ると表彰が表示されます。</Muted>}
        {results.map((r, i) => (
          <View key={`${r.title}-${i}`} style={styles.awardRow}>
            <Text style={styles.awardTitle}>{r.title}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.awardName}>{r.playerName}</Text>
              {r.detail ? <Muted>{r.detail}</Muted> : null}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>ドラコン・ニアピン</SectionTitle>
        {event.specialAwards.map((a) => (
          <View key={a.id} style={styles.special}>
            <View style={styles.inline}>
              <Text style={styles.kind}>{a.kind === 'drive' ? 'ドラコン' : 'ニアピン'}</Text>
              <Stepper value={a.hole} min={1} max={18} onChange={(hole) => patch(a.id, { hole })} />
              <Muted>番ホール（Par {event.pars[a.hole - 1]}）</Muted>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => remove(a.id)} hitSlop={8} accessibilityLabel="削除">
                <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {event.players.map((p) => {
                const selected = a.winnerPlayerId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => patch(a.id, { winnerPlayerId: selected ? undefined : p.id })}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && { color: '#fff' }]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {a.kind === 'pin' && (
              <TextInput
                value={a.note ?? ''}
                onChangeText={(note) => patch(a.id, { note })}
                placeholder="距離など（例：1.2m）"
                placeholderTextColor={colors.muted}
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
  awardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  awardTitle: { width: 112, fontWeight: '700', color: colors.primary },
  awardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  special: {
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kind: { fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
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
