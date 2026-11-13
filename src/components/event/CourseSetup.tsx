import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { ParGrid } from '@/components/event/ParGrid.tsx';
import { Button, Card, CommitField, Muted, Notice, SectionTitle, colors } from '@/components/ui.tsx';
import { pickHiddenHoles, sum } from '@/domain/scoring.ts';
import type { OrganizerTabProps } from './types.ts';

/**
 * コンペ作成直後の必須ステップ：コースのパーを確定する。
 * 確定するまで、参加者登録やリンク配布には進めない。
 */
export function CourseSetup({ bundle, run, onDone }: OrganizerTabProps & { onDone: () => void }) {
  const { event } = bundle;
  const [pars, setPars] = useState(event.pars);
  const count = (p: number) => pars.filter((x) => x === p).length;

  const confirm = () =>
    run(async () => {
      // 新ペリアの隠しホールは、確定したパーで抽選し直す
      await api.updateEvent(event.id, { pars, hiddenHoles: pickHiddenHoles(pars), parsConfirmed: true });
      onDone();
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.steps}>
        <Text style={[styles.step, styles.stepActive]}>1 コースのパー</Text>
        <Text style={styles.step}>2 参加者・組分け</Text>
        <Text style={styles.step}>3 リンクを配る</Text>
      </View>
      <Card>
        <SectionTitle>コースのパーを設定してください</SectionTitle>
        <Muted>
          ゴルフ場のスコアカードや公式サイトを見ながら、各ホールのパーを合わせます。ホールの数字をタップすると、パー3 → 4 → 5 と切り替わります。
        </Muted>
        <CommitField
          label="ゴルフ場"
          value={event.courseName}
          placeholder="例：〇〇カントリークラブ 東→西コース"
          onCommit={(courseName) => run(() => api.updateEvent(event.id, { courseName }))}
        />
        <ParGrid pars={pars} onChange={setPars} />
        <Text style={styles.total}>
          合計 パー{sum(pars)}（パー3 × {count(3)}・パー4 × {count(4)}・パー5 × {count(5)}）
        </Text>
        <Notice tone="info">
          初期値は、よくあるパー72の並びです。実際のコースと違うと、順位や新ペリアのハンデが正しく計算されません。
        </Notice>
        <Button title="このパーで確定して、参加者の登録へ" onPress={confirm} />
        <Muted>確定した後でも「設定」タブから変更できます。</Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  steps: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  stepActive: { color: '#fff', backgroundColor: colors.primary, borderColor: colors.primary },
  total: { fontSize: 15, fontWeight: '700', color: colors.text },
});
