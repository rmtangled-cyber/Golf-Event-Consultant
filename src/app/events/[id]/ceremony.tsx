import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { ceremonySequence } from '@/domain/scoring.ts';
import { useLoader } from '@/hooks/useLoader.ts';

/**
 * 表彰式モード：下位の賞から1つずつ発表する全画面表示。
 * タップ（または → キー・スペース）で「賞の名前 → 受賞者」の順に進む。
 */
export default function CeremonyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: bundle } = useLoader(() => api.getEvent(id), [id]);
  // step 0 = 表紙、以後 2つずつ（賞の名前 / 受賞者）
  const [step, setStep] = useState(0);

  const sequence = bundle ? ceremonySequence(toCompeEvent(bundle)) : [];
  const last = sequence.length * 2 + 1; // 最後のあいさつ
  const next = () => setStep((s) => Math.min(last, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const index = Math.floor((step - 1) / 2);
  const award = step > 0 && step < last ? sequence[index] : undefined;
  const revealed = step > 0 && step % 2 === 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable accessibilityRole="button" accessibilityLabel="次へ" onPress={next} style={styles.stage}>
        {!bundle ? null : step === 0 ? (
          <>
            <Text style={styles.kicker}>表彰式</Text>
            <Text style={styles.eventName}>{bundle.event.name}</Text>
            {bundle.event.status !== 'final' && <Text style={styles.warn}>まだ結果が確定していません</Text>}
            <Text style={styles.hint}>
              {sequence.length === 0 ? 'ホールアウトした人がいないため、発表する賞がありません' : 'タップして始める'}
            </Text>
          </>
        ) : award ? (
          <>
            <Text style={styles.progress}>
              {index + 1} / {sequence.length}
            </Text>
            <Text style={[styles.title, award.key === 'winner' && styles.titleWinner]}>{award.title}</Text>
            {revealed ? (
              <>
                <Text style={styles.name}>{award.playerName} さん</Text>
                {award.detail ? <Text style={styles.detail}>{award.detail}</Text> : null}
              </>
            ) : (
              <Text style={styles.hint}>タップして発表</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.eventName}>おめでとうございます！</Text>
            <Text style={styles.hint}>以上で表彰を終わります</Text>
          </>
        )}
      </Pressable>
      <View style={styles.controls}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="表彰式モードを終わる">
          <Text style={styles.control}>✕ 終わる</Text>
        </Pressable>
        <Pressable onPress={prev} hitSlop={12} disabled={step === 0} accessibilityLabel="戻る">
          <Text style={[styles.control, step === 0 && { opacity: 0.3 }]}>← 戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F3D22' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  kicker: { color: '#9FD3B0', fontSize: 20, fontWeight: '700', letterSpacing: 4 },
  eventName: { color: '#fff', fontSize: 34, fontWeight: '800', textAlign: 'center' },
  warn: { color: '#F6D58A', fontSize: 16, fontWeight: '700' },
  hint: { color: '#9FD3B0', fontSize: 18, marginTop: 12 },
  progress: { color: '#9FD3B0', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { color: '#F6D58A', fontSize: 40, fontWeight: '800', textAlign: 'center' },
  titleWinner: { fontSize: 56 },
  name: { color: '#fff', fontSize: 52, fontWeight: '900', textAlign: 'center' },
  detail: { color: '#CFE6D7', fontSize: 20, textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  control: { color: '#CFE6D7', fontSize: 16, fontWeight: '700' },
});
