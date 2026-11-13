import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AwardInfo, EventInfo, PlayerInfo, ScoreEntry, ScoreInfo } from '@/api/types.ts';
import { Button, Card, Chip, Muted, SectionTitle, Stepper, colors, formatToPar, strokeColor } from '@/components/ui.tsx';
import { nowIso } from '@/lib/errors.ts';
import { applyPending } from '@/sync/outbox.ts';

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

const SCORE_NAMES: Record<number, string> = {
  [-3]: 'アルバトロス',
  [-2]: 'イーグル',
  [-1]: 'バーディー',
  0: 'パー',
  1: 'ボギー',
  2: 'ダブルボギー',
  3: 'トリプル',
};

export interface GroupScoreEditorProps {
  event: EventInfo;
  players: PlayerInfo[];
  scores: ScoreInfo[];
  awards: AwardInfo[];
  /** 暫定トップの名前表示用（コンペ全体の参加者） */
  allPlayers: { id: string; groupId: string | null; name: string }[];
  /** ドラコン・ニアピンで選べる人（組代表は自分の組の人だけ） */
  awardCandidates: PlayerInfo[];
  readOnly?: boolean;
  onChange: (entries: ScoreEntry[]) => void;
  onAwardWinner?: (awardId: string, playerId: string | null, note: string) => void;
}

/** 1ホールずつ、組の全員分の打数を入力する */
export function GroupScoreEditor(props: GroupScoreEditorProps) {
  const { event, players, scores: propScores, awards, allPlayers, awardCandidates, readOnly, onChange, onAwardWinner } = props;
  // 押した瞬間の入力を覚えておく。素早く連打したり、すぐ「次へ」を押したりしても、
  // 画面の更新を待たずに最新の値から計算する（古い値で上書きしない）
  const typedRef = useRef(new Map<string, ScoreEntry>());
  const [typed, setTyped] = useState<ScoreEntry[]>([]);
  const scores = applyPending(propScores, typed);
  const latest = (playerId: string, hole: number) =>
    applyPending(propScores, [...typedRef.current.values()]).find((s) => s.playerId === playerId && s.hole === hole);
  const emit = (entries: ScoreEntry[]) => {
    for (const e of entries) typedRef.current.set(`${e.playerId}|${e.hole}`, e);
    setTyped([...typedRef.current.values()]);
    onChange(entries);
  };
  const scoreOf = (playerId: string, hole: number) => scores.find((s) => s.playerId === playerId && s.hole === hole);
  const holeDone = (hole: number) => players.length > 0 && players.every((p) => scoreOf(p.id, hole));
  const firstOpen = HOLES.find((h) => !holeDone(h)) ?? 1;
  const [hole, setHole] = useState(firstOpen);
  const par = event.pars[hole - 1];

  const entryFor = (playerId: string, patch: Partial<ScoreEntry>): ScoreEntry => {
    const current = latest(playerId, hole);
    return {
      playerId,
      hole,
      strokes: current?.strokes ?? par,
      putts: current?.putts ?? null,
      penalties: current?.penalties ?? null,
      ...patch,
      updatedAt: nowIso(),
    };
  };

  const confirmAndNext = () => {
    // 未入力の人は、表示中の値（パー）で確定する
    const missing = players.filter((p) => !latest(p.id, hole)).map((p) => entryFor(p.id, {}));
    if (missing.length) emit(missing);
    if (hole < 18) setHole(hole + 1);
  };

  const holeAwards = awards.filter((a) => a.hole === hole);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.holeStrip}>
        {HOLES.map((h) => (
          <Pressable
            key={h}
            accessibilityLabel={`${h}番ホール`}
            onPress={() => setHole(h)}
            style={[styles.holeChip, holeDone(h) && styles.holeChipDone, h === hole && styles.holeChipActive]}
          >
            <Text style={[styles.holeChipText, (h === hole || holeDone(h)) && { color: h === hole ? '#fff' : colors.primaryDark }]}>
              {h}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <View style={styles.holeHeader}>
          <Text style={styles.holeTitle}>{hole}番ホール</Text>
          <Text style={styles.holePar}>Par {par}</Text>
        </View>
        {players.map((p) => {
          const s = scoreOf(p.id, hole);
          const shown = s?.strokes ?? par;
          return (
            <View key={p.id} style={styles.playerRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Muted>{s ? (SCORE_NAMES[s.strokes - par] ?? formatToPar(s.strokes - par)) : '未入力'}</Muted>
              </View>
              <View style={styles.strokeBox}>
                <Pressable
                  accessibilityLabel={`${p.name}の打数を減らす`}
                  disabled={readOnly}
                  onPress={() => emit([entryFor(p.id, { strokes: Math.max(1, (latest(p.id, hole)?.strokes ?? par) - 1) })])}
                  style={styles.bigBtn}
                >
                  <Text style={styles.bigBtnText}>−</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`${p.name}の打数を確定`}
                  disabled={readOnly}
                  onPress={() => !latest(p.id, hole) && emit([entryFor(p.id, {})])}
                >
                  <Text style={[styles.strokes, { color: s ? strokeColor(s.strokes, par) : colors.border }]}>{shown}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`${p.name}の打数を増やす`}
                  disabled={readOnly}
                  onPress={() => emit([entryFor(p.id, { strokes: Math.min(30, (latest(p.id, hole)?.strokes ?? par) + 1) })])}
                  style={styles.bigBtn}
                >
                  <Text style={styles.bigBtnText}>＋</Text>
                </Pressable>
              </View>
              {(event.trackPutts || event.trackPenalties) && (
                <View style={styles.extras}>
                  {event.trackPutts && (
                    <View style={styles.extra}>
                      <Muted>パット</Muted>
                      <Stepper
                        label={`${p.name}のパット`}
                        value={s?.putts ?? 0}
                        min={0}
                        max={10}
                        disabled={readOnly}
                        onChange={(putts) => emit([entryFor(p.id, { putts })])}
                      />
                    </View>
                  )}
                  {event.trackPenalties && (
                    <View style={styles.extra}>
                      <Muted>OB・罰打</Muted>
                      <Stepper
                        label={`${p.name}のOB・罰打`}
                        value={s?.penalties ?? 0}
                        min={0}
                        max={10}
                        disabled={readOnly}
                        onChange={(penalties) => emit([entryFor(p.id, { penalties })])}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
        {!readOnly && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="← 前"
              variant="secondary"
              disabled={hole === 1}
              onPress={() => setHole(hole - 1)}
              style={{ flex: 1 }}
            />
            <Button
              title={holeDone(hole) ? (hole === 18 ? '最終ホール' : '次のホールへ →') : '確定して次へ'}
              onPress={confirmAndNext}
              disabled={holeDone(hole) && hole === 18}
              style={{ flex: 2 }}
            />
          </View>
        )}
        {!readOnly && <Muted>未入力の人は、表示中の打数（パー）で確定されます。</Muted>}
      </Card>

      {holeAwards.map((a) => (
        <AwardCard
          key={a.id}
          award={a}
          allPlayers={allPlayers}
          candidates={awardCandidates}
          readOnly={readOnly || !onAwardWinner}
          onSet={(playerId, note) => onAwardWinner?.(a.id, playerId, note)}
        />
      ))}

      <ScoreSummary event={event} players={players} scores={scores} />
    </View>
  );
}

function AwardCard({
  award,
  allPlayers,
  candidates,
  readOnly,
  onSet,
}: {
  award: AwardInfo;
  allPlayers: GroupScoreEditorProps['allPlayers'];
  candidates: PlayerInfo[];
  readOnly?: boolean;
  onSet: (playerId: string | null, note: string) => void;
}) {
  const [note, setNote] = useState(award.note);
  const winner = allPlayers.find((p) => p.id === award.winnerPlayerId);
  const label = award.kind === 'drive' ? 'ドラコン' : 'ニアピン';
  return (
    <Card style={{ borderColor: colors.accent }}>
      <SectionTitle>
        🏆 {label}ホール
      </SectionTitle>
      <Text style={{ color: colors.text }}>
        暫定トップ：<Text style={{ fontWeight: '800' }}>{winner?.name ?? 'まだいません'}</Text>
        {award.note ? `（${award.note}）` : ''}
      </Text>
      {!readOnly && (
        <>
          <Muted>この組の人が暫定トップを更新したら、その人を選んでください。</Muted>
          <View style={styles.chips}>
            {candidates.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={award.winnerPlayerId === p.id}
                onPress={() => onSet(award.winnerPlayerId === p.id ? null : p.id, note)}
              />
            ))}
          </View>
          {award.kind === 'pin' && (
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={() => award.winnerPlayerId && onSet(award.winnerPlayerId, note)}
              placeholder="メモ（任意・例：1.2m）"
              placeholderTextColor={colors.muted}
              style={styles.note}
            />
          )}
        </>
      )}
    </Card>
  );
}

function ScoreSummary({ event, players, scores }: { event: EventInfo; players: PlayerInfo[]; scores: ScoreInfo[] }) {
  return (
    <Card>
      <SectionTitle>スコア</SectionTitle>
      {players.map((p) => {
        const mine = scores.filter((s) => s.playerId === p.id);
        const sumOf = (from: number, to: number) =>
          mine.filter((s) => s.hole >= from && s.hole <= to).reduce((a, s) => a + s.strokes, 0);
        const toPar = mine.reduce((a, s) => a + s.strokes - event.pars[s.hole - 1], 0);
        return (
          <View key={p.id} style={styles.summaryRow}>
            <Text style={[styles.playerName, { flex: 1 }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.summaryCell}>OUT {sumOf(1, 9)}</Text>
            <Text style={styles.summaryCell}>IN {sumOf(10, 18)}</Text>
            <Text style={[styles.summaryCell, { fontWeight: '800' }]}>{sumOf(1, 18)}</Text>
            <Text style={[styles.summaryCell, { color: colors.muted }]}>
              {mine.length}H {mine.length ? formatToPar(toPar) : ''}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  holeStrip: { gap: 6, paddingVertical: 2 },
  holeChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeChipDone: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  holeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  holeChipText: { fontWeight: '700', color: colors.muted },
  holeHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  holeTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
  holePar: { fontSize: 18, fontWeight: '700', color: colors.text },
  playerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  playerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  strokeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bigBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnText: { fontSize: 26, fontWeight: '700', color: colors.primaryDark },
  strokes: { fontSize: 36, fontWeight: '800', minWidth: 48, textAlign: 'center' },
  extras: { flexDirection: 'row', gap: 16, width: '100%', flexWrap: 'wrap' },
  extra: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summaryCell: { fontSize: 13, color: colors.text, minWidth: 44, textAlign: 'right' },
});
