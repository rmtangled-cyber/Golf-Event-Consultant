import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, outbox } from '@/api/index.ts';
import { ApiError } from '@/api/types.ts';
import type { ApiErrorCode, ScoreEntry } from '@/api/types.ts';
import { confirm } from '@/components/confirm.ts';
import { GroupScoreEditor } from '@/components/GroupScoreEditor.tsx';
import { AnnouncementList, LiveBanner } from '@/components/LiveNotices.tsx';
import { NotificationPanel } from '@/components/NotificationPanel.tsx';
import { Button, Card, Muted, Notice, Screen, colors } from '@/components/ui.tsx';
import { useLoader } from '@/hooks/useLoader.ts';
import { useOutbox } from '@/hooks/useOutbox.ts';
import { errorMessage } from '@/lib/errors.ts';
import { applyPending } from '@/sync/outbox.ts';

/** 組の入力リンク：組代表が全員分のスコアを入力して提出する（ログイン不要） */
export default function GroupInputScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data: bundle, error, loading, reload } = useLoader(() => api.getGroupInput(token), [token], 30_000);
  const outboxState = useOutbox();
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 送信待ちの入力を、サーバーのスコアに重ねて表示する
  const [, setTick] = useState(0);

  if (!bundle) {
    return (
      <Screen style={{ padding: 16 }}>
        {!loading && (
          <Card>
            <Muted>{error ? errorMessage(error) : 'リンクが無効です。幹事に新しいリンクをもらってください。'}</Muted>
          </Card>
        )}
      </Screen>
    );
  }

  const pending = outbox.pendingFor(token);
  const scores = applyPending(bundle.scores, pending);
  const final = bundle.event.status === 'final';
  const submitted = !!bundle.group.submittedAt;
  const readOnly = final || submitted;
  const complete = bundle.players.length > 0 && bundle.players.every((p) => scores.filter((s) => s.playerId === p.id).length === 18);

  const onChange = async (entries: ScoreEntry[]) => {
    await outbox.enqueue(token, entries);
    setTick((t) => t + 1);
  };

  const submit = () =>
    confirm('スコアを提出しますか？提出後はこの組の入力を変更できなくなります（修正は幹事が行います）。', async () => {
      setSubmitting(true);
      setActionError(null);
      try {
        await outbox.flush();
        if (outbox.pendingFor(token).length > 0) throw new Error('pending');
        await api.submitGroup(token);
      } catch (e) {
        setActionError(
          e instanceof Error && e.message === 'pending'
            ? '未送信の入力があります。電波の良い場所で、もう一度提出してください。'
            : errorMessage(e),
        );
      }
      setSubmitting(false);
      await reload();
    }, '提出');

  return (
    <Screen>
      <Stack.Screen options={{ title: `${bundle.group.number}組のスコア入力` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eventName}>{bundle.event.name}</Text>
          <Muted>
            {bundle.event.date} {bundle.event.courseName}
          </Muted>
        </View>

        <LiveBanner awards={bundle.awards} announcements={bundle.announcements} players={bundle.allPlayers} />
        {final && <Notice tone="success">結果が確定しました。閲覧リンクから順位を確認できます。</Notice>}
        {!final && submitted && <Notice tone="success">提出済みです。修正が必要なときは幹事に連絡してください。</Notice>}
        {!readOnly && <SyncStatus pending={outboxState.pending} failing={outboxState.failing} />}
        {outboxState.rejected?.token === token && (
          <Notice tone="danger">
            {outboxState.rejected.count}件の入力を送れませんでした（{errorMessage(new ApiError(outboxState.rejected.code as ApiErrorCode))}）
          </Notice>
        )}
        {error ? <Notice tone="warning">最新の情報を読み込めませんでした。入力は端末に保存されています。</Notice> : null}
        {actionError ? <Notice tone="danger">{actionError}</Notice> : null}

        <GroupScoreEditor
          event={bundle.event}
          players={bundle.players}
          scores={scores}
          awards={bundle.awards}
          allPlayers={bundle.allPlayers}
          awardCandidates={bundle.players}
          readOnly={readOnly}
          onChange={onChange}
          onAwardWinner={(awardId, playerId, note) =>
            void api
              .setAwardWinner(token, awardId, playerId, note)
              .then(() => (playerId ? api.notifyAward(awardId) : undefined))
              .catch((e) => setActionError(errorMessage(e)))
              .then(reload)
          }
        />

        {!readOnly && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text }}>ホールアウトしたら提出</Text>
            <Muted>全員の18ホールを入力すると提出できます。提出後の修正は幹事が行います。</Muted>
            <Button title="スコアを提出する" onPress={submit} disabled={!complete || submitting} />
          </Card>
        )}

        <AnnouncementList announcements={bundle.announcements} />
        {!final && <NotificationPanel viewToken={bundle.event.viewToken} />}

        <Link href={{ pathname: '/v/[token]', params: { token: bundle.event.viewToken } }} style={styles.link}>
          順位を見る →
        </Link>
      </ScrollView>
    </Screen>
  );
}

/**
 * 送信の状態。普段は1行だけの控えめな表示にして、入力欄の位置がずれないようにする。
 * 黄色の警告は、実際に送れなかったときだけ。
 */
function SyncStatus({ pending, failing }: { pending: number; failing: boolean }) {
  const [label, color, bg] = failing
    ? [`⚠ 電波待ち：未送信 ${pending}件（自動で再送）`, '#7A5A0E', '#FDF3DC']
    : pending > 0
      ? ['送信中…', colors.muted, 'transparent']
      : ['✓ すべて送信済み', colors.primaryDark, 'transparent'];
  return (
    <View style={[styles.sync, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.syncText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { gap: 2 },
  eventName: { fontSize: 18, fontWeight: '800', color: colors.text },
  sync: { height: 28, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8 },
  syncText: { fontSize: 13, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15, textAlign: 'center', paddingVertical: 8 },
});
