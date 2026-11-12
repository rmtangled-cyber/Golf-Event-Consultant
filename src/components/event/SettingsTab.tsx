import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from '@/components/confirm.ts';
import { Stepper } from '@/components/event/PlayersTab.tsx';
import { Button, Card, Field, Muted, SectionTitle, Segmented, colors } from '@/components/ui.tsx';
import { HANDICAP_OPTIONS } from '@/domain/labels.ts';
import { pickHiddenHoles, sum } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';
import { useEvents } from '@/store/EventsContext.tsx';

export function SettingsTab({
  event,
  update,
}: {
  event: CompeEvent;
  update: (fn: (e: CompeEvent) => CompeEvent) => void;
}) {
  const { deleteEvent } = useEvents();
  const [showHidden, setShowHidden] = useState(false);
  const hidden = new Set(event.hiddenHoles);

  const cyclePar = (index: number) =>
    update((e) => {
      const pars = [...e.pars];
      pars[index] = pars[index] >= 5 ? 3 : pars[index] + 1;
      return { ...e, pars };
    });

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>基本情報</SectionTitle>
        <Field label="コンペ名" value={event.name} onChangeText={(name) => update((e) => ({ ...e, name }))} />
        <Field label="開催日" value={event.date} onChangeText={(date) => update((e) => ({ ...e, date }))} />
        <Field
          label="ゴルフ場"
          value={event.courseName}
          onChangeText={(courseName) => update((e) => ({ ...e, courseName }))}
        />
      </Card>

      <Card>
        <SectionTitle>パー設定（合計 {sum(event.pars)}）</SectionTitle>
        <Muted>タップでパー3→4→5を切り替え</Muted>
        {[0, 9].map((start) => (
          <View key={start} style={styles.parRow}>
            {event.pars.slice(start, start + 9).map((par, i) => {
              const index = start + i;
              const isHidden = showHidden && hidden.has(index + 1);
              return (
                <Pressable key={index} onPress={() => cyclePar(index)} style={[styles.parCell, isHidden && styles.hiddenCell]}>
                  <Text style={styles.parHole}>{index + 1}</Text>
                  <Text style={styles.parValue}>{par}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>ハンデ方式</SectionTitle>
        <Segmented
          options={HANDICAP_OPTIONS}
          value={event.handicapMethod}
          onChange={(handicapMethod) => update((e) => ({ ...e, handicapMethod }))}
        />
        {event.handicapMethod === 'shin-peoria' && (
          <>
            <View style={styles.inline}>
              <Muted>ハンデ上限</Muted>
              <Stepper
                value={event.handicapCap}
                min={0}
                max={54}
                onChange={(handicapCap) => update((e) => ({ ...e, handicapCap }))}
              />
            </View>
            <Muted>
              隠しホール：{showHidden ? event.hiddenHoles.join('・') + '番' : '●●●（非公開）'}
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
                  confirm('隠しホールを抽選し直しますか？', () =>
                    update((e) => ({ ...e, hiddenHoles: pickHiddenHoles(e.pars) })),
                  )
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
          confirm(`「${event.name}」を削除しますか？この操作は取り消せません。`, () => {
            deleteEvent(event.id);
            router.replace('/');
          }, '削除')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  parRow: { flexDirection: 'row', gap: 4 },
  parCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
  },
  hiddenCell: { backgroundColor: '#F6E7B0' },
  parHole: { fontSize: 10, color: colors.muted },
  parValue: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
