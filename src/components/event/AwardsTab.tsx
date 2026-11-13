import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import type { AwardInfo, CustomAwardInfo } from '@/api/types.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { AwardResults } from '@/components/event/AwardResults.tsx';
import { ResultActions } from '@/components/event/ResultActions.tsx';
import { STANDARD_AWARD_OPTIONS } from '@/domain/scoring.ts';
import type { StandardAwardKey } from '@/domain/types.ts';
import { Button, Card, Chip, CommitField, Muted, SectionTitle, Stepper, colors } from '@/components/ui.tsx';
import type { OrganizerTabProps } from './types.ts';

export function AwardsTab({ bundle, run }: OrganizerTabProps) {
  const { event, awards, players, customAwards } = bundle;
  const compe = toCompeEvent(bundle);
  const hidden = new Set(event.hiddenAwards);
  const toggleStandard = (key: StandardAwardKey) => {
    const next = hidden.has(key) ? event.hiddenAwards.filter((k) => k !== key) : [...event.hiddenAwards, key];
    void run(() => api.updateEvent(event.id, { hiddenAwards: next }));
  };
  const addCustom = (title: string, rule: CustomAwardInfo['rule'], rank?: number) =>
    run(() => api.addCustomAward(event.id, { title, rule, rank }));
  // 暫定トップが変わったら、通知を受け取る設定の人に知らせる
  const setSpecialWinner = (awardId: string, winnerPlayerId: string | null) =>
    run(async () => {
      await api.updateAward(awardId, { winnerPlayerId });
      if (winnerPlayerId) void api.notifyAward(awardId);
    });

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
      <ResultActions event={compe} organizer />
      <AwardResults event={compe} />
      <Card>
        <SectionTitle>定番の賞</SectionTitle>
        <Muted>タップで表示・非表示を切り替えます。優勝は常に表示されます。</Muted>
        <View style={styles.chips}>
          {STANDARD_AWARD_OPTIONS.map((o) => (
            <Chip key={o.key} label={o.title} selected={!hidden.has(o.key)} onPress={() => toggleStandard(o.key)} />
          ))}
        </View>
      </Card>
      <Card>
        <SectionTitle>追加の賞</SectionTitle>
        {customAwards.length === 0 && <Muted>飛び賞やOB王など、会のオリジナルの賞を追加できます。</Muted>}
        {customAwards.map((c) => (
          <View key={c.id} style={styles.special}>
            <View style={styles.inline}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <CommitField value={c.title} onCommit={(title) => run(() => api.updateCustomAward(c.id, { title }))} style={styles.note} />
              </View>
              <Pressable onPress={() => run(() => api.deleteCustomAward(c.id))} hitSlop={8} accessibilityLabel={`${c.title}を削除`}>
                <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            {c.rule === 'rank' && (
              <View style={styles.inline}>
                <Stepper
                  label="順位"
                  value={c.rank ?? 1}
                  min={1}
                  max={200}
                  onChange={(rank) => run(() => api.updateCustomAward(c.id, { rank }))}
                />
                <Muted>位の人</Muted>
              </View>
            )}
            {c.rule === 'most_penalties' && (
              <Muted>
                OB・罰打の合計が最も多い人（同数は全員）。{!event.trackPenalties && '※「設定」でOB・罰打の入力をオンにしてください。'}
              </Muted>
            )}
            {c.rule === 'most_putts' && (
              <Muted>
                パット数の合計が最も多い人（同数は全員）。{!event.trackPutts && '※「設定」でパット数の入力をオンにしてください。'}
              </Muted>
            )}
            {c.rule === 'manual' && (
              <View style={styles.chips}>
                {players.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    selected={c.winnerPlayerId === p.id}
                    onPress={() =>
                      run(() => api.updateCustomAward(c.id, { winnerPlayerId: c.winnerPlayerId === p.id ? null : p.id }))
                    }
                  />
                ))}
              </View>
            )}
          </View>
        ))}
        <View style={styles.chips}>
          <Button title="＋ 飛び賞" variant="secondary" onPress={() => addCustom('飛び賞', 'rank', Math.min(10, Math.max(4, players.length - 3)))} />
          <Button title="＋ OB王" variant="secondary" onPress={() => addCustom('OB王', 'most_penalties')} />
          <Button title="＋ 最多パット" variant="secondary" onPress={() => addCustom('最多パット賞', 'most_putts')} />
          <Button title="＋ 自由に選ぶ賞" variant="secondary" onPress={() => addCustom('特別賞', 'manual')} />
        </View>
      </Card>
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
                  onPress={() => setSpecialWinner(a.id, a.winnerPlayerId === p.id ? null : p.id)}
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
