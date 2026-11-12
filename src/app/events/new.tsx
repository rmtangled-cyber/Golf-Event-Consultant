import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { api } from '@/api/index.ts';
import { Button, Card, Field, Muted, Notice, Screen, Segmented } from '@/components/ui.tsx';
import { HANDICAP_OPTIONS } from '@/domain/labels.ts';
import { DEFAULT_PARS, pickHiddenHoles } from '@/domain/scoring.ts';
import type { HandicapMethod } from '@/domain/types.ts';
import { errorMessage } from '@/lib/errors.ts';

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function NewEventScreen() {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [courseName, setCourseName] = useState('');
  const [method, setMethod] = useState<HandicapMethod>('shin-peoria');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await api.createEvent({
        name: name.trim() || '無題のコンペ',
        date,
        courseName: courseName.trim(),
        handicapMethod: method,
        hiddenHoles: pickHiddenHoles(DEFAULT_PARS),
      });
      router.replace({ pathname: '/events/[id]', params: { id, tab: 'players' } });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Field label="コンペ名" value={name} onChangeText={setName} placeholder="例：第10回 〇〇会コンペ" />
          <Field label="開催日" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Field label="ゴルフ場" value={courseName} onChangeText={setCourseName} placeholder="例：〇〇カントリークラブ" />
        </Card>
        <Card>
          <Segmented options={HANDICAP_OPTIONS} value={method} onChange={setMethod} />
          <Muted>
            {method === 'shin-peoria'
              ? '隠しホール12ホールのスコアからハンデを自動計算します（上限36）。'
              : method === 'fixed'
                ? '参加者ごとに申告ハンデを入力します。'
                : 'グロスで順位を決めます。'}
          </Muted>
          <Muted>パー・順位の公開方法などは、作成後に「設定」から変更できます。</Muted>
        </Card>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="作成して参加者を登録" onPress={submit} disabled={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
