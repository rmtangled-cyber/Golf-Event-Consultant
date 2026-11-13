import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import type { EventPatch } from '@/api/types.ts';
import { confirm } from '@/components/confirm.ts';
import { ParGrid } from '@/components/event/ParGrid.tsx';
import { Button, Card, CommitField, Muted, SectionTitle, Segmented, Stepper, colors } from '@/components/ui.tsx';
import { HANDICAP_OPTIONS } from '@/domain/labels.ts';
import { pickHiddenHoles, sum } from '@/domain/scoring.ts';
import type { OrganizerTabProps } from './types.ts';

export function SettingsTab({ bundle, run }: OrganizerTabProps) {
  const { event } = bundle;
  const [showHidden, setShowHidden] = useState(false);
  const hidden = new Set(event.hiddenHoles);
  const save = (patch: EventPatch) => run(() => api.updateEvent(event.id, patch));

  const hasScores = bundle.scores.length > 0;
  // スコア入力の前なら、パーを変えたら隠しホールも抽選し直す（構成がずれないように）
  const changePars = (pars: number[]) =>
    save(hasScores ? { pars } : { pars, hiddenHoles: pickHiddenHoles(pars) });

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>基本情報</SectionTitle>
        <CommitField label="コンペ名" value={event.name} onCommit={(name) => save({ name })} />
        <CommitField label="開催日" value={event.date} onCommit={(date) => save({ date })} />
        <CommitField label="ゴルフ場" value={event.courseName} onCommit={(courseName) => save({ courseName })} />
      </Card>

      <Card>
        <SectionTitle>順位の公開</SectionTitle>
        <Segmented
          options={[
            { value: 'live', label: 'プレー中も公開' },
            { value: 'hidden', label: '表彰式まで非公開' },
          ]}
          value={event.visibility}
          onChange={(visibility) => save({ visibility })}
        />
        <Muted>
          {event.visibility === 'live'
            ? '閲覧リンクで、プレー中からスコアと暫定順位が見られます。新ペリアのハンデとネットは結果確定後に表示されます。'
            : '結果を確定するまで、閲覧リンクではスコアと順位を表示しません（幹事は常に見られます）。'}
        </Muted>
      </Card>

      <Card>
        <SectionTitle>入力する項目</SectionTitle>
        <Muted>打数は必須です。パット数とOB・罰打は、必要なときだけ組代表に入力してもらえます。</Muted>
        <Toggle label="パット数" value={event.trackPutts} onChange={(trackPutts) => save({ trackPutts })} />
        <Toggle label="OB・罰打" value={event.trackPenalties} onChange={(trackPenalties) => save({ trackPenalties })} />
      </Card>

      <Card>
        <SectionTitle>パー設定（合計 {sum(event.pars)}）</SectionTitle>
        <Muted>タップでパー3→4→5を切り替え</Muted>
        <ParGrid pars={event.pars} onChange={changePars} highlight={showHidden ? hidden : undefined} />
        {hasScores && <Muted>スコア入力が始まっているため、隠しホールは自動では変わりません。必要なら下の「再抽選」を押してください。</Muted>}
      </Card>

      <Card>
        <SectionTitle>ハンデ方式</SectionTitle>
        <Segmented options={HANDICAP_OPTIONS} value={event.handicapMethod} onChange={(handicapMethod) => save({ handicapMethod })} />
        {event.handicapMethod === 'shin-peoria' && (
          <>
            <View style={styles.inline}>
              <Muted>ハンデ上限</Muted>
              <Stepper label="ハンデ上限" value={event.handicapCap} min={0} max={54} onChange={(handicapCap) => save({ handicapCap })} />
            </View>
            <Muted>
              隠しホール：{showHidden ? `${event.hiddenHoles.join('・')}番` : '●●●（非公開）'}
              {showHidden ? `（パー計 ${event.hiddenHoles.reduce((a, h) => a + event.pars[h - 1], 0)}）` : ''}
            </Muted>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={showHidden ? '隠しホールを隠す' : '隠しホールを表示'}
                variant="secondary"
                onPress={() => setShowHidden((v) => !v)}
                style={{ flex: 1 }}
              />
              <Button
                title="再抽選"
                variant="secondary"
                onPress={() =>
                  confirm('隠しホールを抽選し直しますか？', () => save({ hiddenHoles: pickHiddenHoles(event.pars) }))
                }
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </Card>

      <Button
        title="このコンペを削除"
        variant="danger"
        onPress={() =>
          confirm(`「${event.name}」を削除しますか？この操作は取り消せません。`, () =>
            run(async () => {
              await api.deleteEvent(event.id);
              router.replace('/');
            }), '削除')
        }
      />
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  parRow: { flexDirection: 'row', gap: 4 },
  parCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: colors.primarySoft },
  hiddenCell: { backgroundColor: '#F6E7B0' },
  parHole: { fontSize: 10, color: colors.muted },
  parValue: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border, padding: 3 },
  toggleOn: { backgroundColor: colors.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 18 }] },
});
