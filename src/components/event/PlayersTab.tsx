import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { confirm } from '@/components/confirm.ts';
import { Button, Card, Field, Muted, SectionTitle, Stepper, colors } from '@/components/ui.tsx';
import type { OrganizerTabProps } from './types.ts';

const GROUP_SIZE = 4;

export function PlayersTab({ bundle, run }: OrganizerTabProps) {
  const { event, groups, players } = bundle;
  const fixed = event.handicapMethod === 'fixed';
  const groupNumberOf = (groupId: string | null) => groups.find((g) => g.id === groupId)?.number ?? 1;
  const countIn = (n: number) => players.filter((p) => groupNumberOf(p.groupId) === n).length;
  const maxGroup = Math.max(1, ...players.map((p) => groupNumberOf(p.groupId)));
  const suggestedGroup = Array.from({ length: maxGroup + 1 }, (_, i) => i + 1).find((n) => countIn(n) < GROUP_SIZE)!;

  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [group, setGroup] = useState<number | null>(null);
  const targetGroup = group ?? suggestedGroup;

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    setHandicap('');
    setGroup(null);
    void run(() =>
      api.addPlayer(event.id, {
        name: trimmed,
        handicap: fixed && handicap !== '' ? Number(handicap) || 0 : null,
        groupNumber: targetGroup,
      }),
    );
  };

  const groupNumbers = [...new Set(players.map((p) => groupNumberOf(p.groupId)))].sort((a, b) => a - b);

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>参加者を追加</SectionTitle>
        <Field label="名前" value={name} onChangeText={setName} placeholder="例：山田 太郎" onSubmitEditing={add} />
        {fixed && (
          <Field label="申告ハンデ" value={handicap} onChangeText={setHandicap} keyboardType="decimal-pad" placeholder="例：18" />
        )}
        <View style={styles.inline}>
          <Muted>組</Muted>
          <Stepper label="組" value={targetGroup} min={1} max={maxGroup + 1} onChange={setGroup} />
          <Muted>（4名ずつ自動で割り当て）</Muted>
        </View>
        <Button title="追加" onPress={add} disabled={!name.trim()} />
      </Card>

      {players.length === 0 && (
        <Card>
          <Muted>参加者を追加してください。</Muted>
        </Card>
      )}
      {groupNumbers.map((n) => (
        <Card key={n}>
          <SectionTitle>
            {n}組（{countIn(n)}名）
          </SectionTitle>
          {players
            .filter((p) => groupNumberOf(p.groupId) === n)
            .map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  {fixed && (
                    <View style={styles.inline}>
                      <Muted>HC</Muted>
                      <Stepper
                        label={`${p.name}のハンデ`}
                        value={p.handicap ?? 0}
                        min={0}
                        max={54}
                        onChange={(v) => run(() => api.updatePlayer(event.id, p.id, { handicap: v }))}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.inline}>
                  <Muted>組</Muted>
                  <Stepper
                    label={`${p.name}の組`}
                    value={n}
                    min={1}
                    max={maxGroup + 1}
                    onChange={(v) => run(() => api.updatePlayer(event.id, p.id, { groupNumber: v }))}
                  />
                </View>
                <Pressable
                  accessibilityLabel={`${p.name}を削除`}
                  hitSlop={8}
                  onPress={() =>
                    confirm(`${p.name} さんを削除しますか？（入力済みスコアも削除されます）`, () =>
                      run(() => api.deletePlayer(p.id)), '削除')
                  }
                >
                  <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
            ))}
        </Card>
      ))}
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
