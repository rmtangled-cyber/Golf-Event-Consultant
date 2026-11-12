import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AwardsTab } from '@/components/event/AwardsTab.tsx';
import { LeaderboardTab } from '@/components/event/LeaderboardTab.tsx';
import { PlayersTab } from '@/components/event/PlayersTab.tsx';
import { ScoresTab } from '@/components/event/ScoresTab.tsx';
import { SettingsTab } from '@/components/event/SettingsTab.tsx';
import { Card, Muted, Screen, Segmented } from '@/components/ui.tsx';
import { useEvent } from '@/store/EventsContext.tsx';

const TABS = [
  { value: 'leaderboard', label: '順位' },
  { value: 'scores', label: 'スコア' },
  { value: 'players', label: '参加者' },
  { value: 'awards', label: '表彰' },
  { value: 'settings', label: '設定' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export default function EventScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { ready, event, update } = useEvent(id);
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'leaderboard';

  if (!event) {
    return (
      <Screen style={{ padding: 16 }}>
        {ready && (
          <Card>
            <Muted>コンペが見つかりません。</Muted>
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: event.name }} />
      <View style={styles.tabs}>
        <Segmented options={[...TABS]} value={tab} onChange={(t) => router.setParams({ tab: t })} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'leaderboard' && <LeaderboardTab event={event} />}
        {tab === 'scores' && <ScoresTab event={event} />}
        {tab === 'players' && <PlayersTab event={event} update={update} />}
        {tab === 'awards' && <AwardsTab event={event} update={update} />}
        {tab === 'settings' && <SettingsTab event={event} update={update} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { padding: 12, paddingBottom: 0, maxWidth: 720, width: '100%', alignSelf: 'center' },
  content: { padding: 12, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
