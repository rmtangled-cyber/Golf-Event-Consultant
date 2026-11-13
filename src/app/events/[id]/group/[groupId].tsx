import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { api } from '@/api/index.ts';
import type { ScoreEntry } from '@/api/types.ts';
import { GroupScoreEditor } from '@/components/GroupScoreEditor.tsx';
import { Card, Muted, Notice, Screen } from '@/components/ui.tsx';
import { useLoader } from '@/hooks/useLoader.ts';
import { errorMessage } from '@/lib/errors.ts';
import { applyPending } from '@/sync/outbox.ts';

/** 幹事による組のスコア確認・修正（提出後・結果確定後も直せる） */
export default function OrganizerGroupScreen() {
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId: string }>();
  const { data: bundle, loading, reload, setData } = useLoader(() => api.getEvent(id), [id], 15_000);
  const [error, setError] = useState<string | null>(null);

  const group = bundle?.groups.find((g) => g.id === groupId);
  if (!bundle || !group) {
    return (
      <Screen style={{ padding: 16 }}>
        {!loading && (
          <Card>
            <Muted>組が見つかりません。</Muted>
          </Card>
        )}
      </Screen>
    );
  }
  const players = bundle.players.filter((p) => p.groupId === group.id);

  const save = async (entries: ScoreEntry[]) => {
    // 画面にはすぐ反映し、保存後に読み直す
    setData({ ...bundle, scores: applyPending(bundle.scores, entries) });
    try {
      setError(null);
      await api.saveScoresAsOrganizer(bundle.event.id, entries);
    } catch (e) {
      setError(errorMessage(e));
    }
    await reload();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `${group.number}組のスコア（幹事）` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice tone="info">
          幹事として編集しています。{group.submittedAt ? '提出済みの組ですが、幹事は修正できます。' : ''}
        </Notice>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <GroupScoreEditor
          event={bundle.event}
          players={players}
          scores={bundle.scores}
          awards={bundle.awards}
          allPlayers={bundle.players}
          awardCandidates={bundle.players}
          onChange={save}
          onAwardWinner={(awardId, playerId, note) =>
            void api
              .updateAward(awardId, { winnerPlayerId: playerId, note })
              .then(() => (playerId ? api.notifyAward(awardId) : undefined))
              .catch((e) => setError(errorMessage(e)))
              .then(reload)
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
