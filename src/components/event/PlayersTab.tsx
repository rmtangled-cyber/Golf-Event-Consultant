import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from '@/components/confirm.ts';
import { Button, Card, Field, Muted, SectionTitle, colors } from '@/components/ui.tsx';
import type { CompeEvent, Player } from '@/domain/types.ts';
import { newId } from '@/store/EventsContext.tsx';

const GROUP_SIZE = 4;

export function PlayersTab({
  event,
  update,
}: {
  event: CompeEvent;
  update: (fn: (e: CompeEvent) => CompeEvent) => void;
}) {
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const fixed = event.handicapMethod === 'fixed';

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((e) => {
      const player: Player = {
        id: newId(),
        name: trimmed,
        group: Math.floor(e.players.length / GROUP_SIZE) + 1,
        handicap: fixed && handicap !== '' ? Number(handicap) || 0 : undefined,
      };
      return { ...e, players: [...e.players, player] };
    });
    setName('');
    setHandicap('');
  };

  const patchPlayer = (id: string, patch: Partial<Player>) =>
    update((e) => ({ ...e, players: e.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const remove = (player: Player) =>
    confirm(`${player.name} さんを削除しますか？（入力済みスコアも削除されます）`, () =>
      update((e) => {
        const { [player.id]: _removed, ...scores } = e.scores;
        return {
          ...e,
          players: e.players.filter((p) => p.id !== player.id),
          scores,
          specialAwards: e.specialAwards.map((a) =>
            a.winnerPlayerId === player.id ? { ...a, winnerPlayerId: undefined } : a,
          ),
        };
      }),
    '削除');

  const groupCount = Math.max(1, ...event.players.map((p) => p.group ?? 1));

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>参加者を追加</SectionTitle>
        <Field
          label="名前"
          value={name}
          onChangeText={setName}
          placeholder="例：山田 太郎"
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {fixed && (
          <Field
            label="申告ハンデ"
            value={handicap}
            onChangeText={setHandicap}
            keyboardType="decimal-pad"
            placeholder="例：18"
          />
        )}
        <Button title="追加" onPress={add} disabled={!name.trim()} />
      </Card>

      <Card>
        <SectionTitle>参加者 {event.players.length}名</SectionTitle>
        {event.players.length === 0 && <Muted>参加者を追加してください。4名ずつ自動で組分けされます。</Muted>}
        {event.players.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{p.name}</Text>
              {fixed && (
                <View style={styles.inline}>
                  <Muted>HC</Muted>
                  <Stepper
                    value={p.handicap ?? 0}
                    min={0}
                    max={54}
                    onChange={(v) => patchPlayer(p.id, { handicap: v })}
                  />
                </View>
              )}
            </View>
            <View style={styles.inline}>
              <Muted>組</Muted>
              <Stepper
                value={p.group ?? 1}
                min={1}
                max={groupCount + 1}
                onChange={(v) => patchPlayer(p.id, { group: v })}
              />
            </View>
            <Pressable accessibilityLabel={`${p.name}を削除`} onPress={() => remove(p)} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn} hitSlop={4}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepBtn} hitSlop={4}>
        <Text style={styles.stepText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  stepValue: { minWidth: 24, textAlign: 'center', fontWeight: '700', color: colors.text },
});
