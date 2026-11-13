import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/index.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { ProvisionalSpecials } from '@/components/event/AwardResults.tsx';
import { AwardsTab } from '@/components/event/AwardsTab.tsx';
import { CourseSetup } from '@/components/event/CourseSetup.tsx';
import { LeaderboardTable } from '@/components/event/LeaderboardTable.tsx';
import { LinksTab } from '@/components/event/LinksTab.tsx';
import { PlayersTab } from '@/components/event/PlayersTab.tsx';
import { ScoresTab } from '@/components/event/ScoresTab.tsx';
import { SettingsTab } from '@/components/event/SettingsTab.tsx';
import { Card, Muted, Notice, Screen, Segmented } from '@/components/ui.tsx';
import { useLoader } from '@/hooks/useLoader.ts';
import { errorMessage } from '@/lib/errors.ts';

const TABS = [
  { value: 'leaderboard', label: '順位' },
  { value: 'scores', label: 'スコア' },
  { value: 'players', label: '参加者' },
  { value: 'links', label: 'リンク' },
  { value: 'awards', label: '表彰' },
  { value: 'settings', label: '設定' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** 幹事のコンペ管理画面 */
export default function EventScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'leaderboard';
  const { data: bundle, error, loading, reload } = useLoader(() => api.getEvent(id), [id], 15_000);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActionError(null);
      try {
        await fn();
      } catch (e) {
        setActionError(errorMessage(e));
      }
      await reload();
    },
    [reload],
  );

  if (!bundle) {
    return (
      <Screen style={{ padding: 16 }}>
        {!loading && (
          <Card>
            <Muted>{error ? errorMessage(error) : 'コンペが見つからないか、幹事として登録されていません。'}</Muted>
          </Card>
        )}
      </Screen>
    );
  }

  const compe = toCompeEvent(bundle);
  const props = { bundle, run };

  // パーを確定するまでは、参加者登録やリンク配布に進めない
  if (!bundle.event.parsConfirmed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: bundle.event.name }} />
        {actionError ? (
          <View style={styles.tabs}>
            <Notice tone="danger">{actionError}</Notice>
          </View>
        ) : null}
        <CourseSetup {...props} onDone={() => router.setParams({ tab: 'players' })} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: bundle.event.name }} />
      <View style={styles.tabs}>
        <Segmented options={[...TABS]} value={tab} onChange={(t) => router.setParams({ tab: t })} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
        {error ? <Notice tone="warning">最新の情報を読み込めませんでした。{errorMessage(error)}</Notice> : null}
        {tab === 'leaderboard' && (
          <>
            {bundle.event.status === 'final' && <Notice tone="success">結果確定済み</Notice>}
            <LeaderboardTable
              event={compe}
              footnote={
                bundle.event.handicapMethod === 'shin-peoria'
                  ? '新ペリア：ハンデはホールアウト後に確定。同ネットはハンデの少ない方が上位。'
                  : undefined
              }
            />
            <ProvisionalSpecials event={compe} />
          </>
        )}
        {tab === 'scores' && <ScoresTab {...props} />}
        {tab === 'players' && <PlayersTab {...props} />}
        {tab === 'links' && <LinksTab {...props} />}
        {tab === 'awards' && <AwardsTab {...props} />}
        {tab === 'settings' && <SettingsTab {...props} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { padding: 12, paddingBottom: 0, maxWidth: 720, width: '100%', alignSelf: 'center' },
  content: { padding: 12, paddingBottom: 40, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
