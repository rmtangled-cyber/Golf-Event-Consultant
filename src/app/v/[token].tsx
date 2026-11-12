import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { toCompeEvent } from '@/api/toCompeEvent.ts';
import { AwardResults, ProvisionalSpecials } from '@/components/event/AwardResults.tsx';
import { LeaderboardTable } from '@/components/event/LeaderboardTable.tsx';
import { Card, Muted, Notice, Screen, SectionTitle, colors } from '@/components/ui.tsx';
import { useLoader } from '@/hooks/useLoader.ts';
import { errorMessage } from '@/lib/errors.ts';

/** 閲覧リンク：順位とドラコン・ニアピン（ログイン不要、15秒ごとに更新） */
export default function ViewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data: bundle, error, loading } = useLoader(() => api.getEventView(token), [token], 15_000);

  if (!bundle) {
    return (
      <Screen style={{ padding: 16 }}>
        {!loading && (
          <Card>
            <Muted>{error ? errorMessage(error) : 'リンクが無効です。'}</Muted>
          </Card>
        )}
      </Screen>
    );
  }

  const { event } = bundle;
  const compe = toCompeEvent(bundle);
  const final = event.status === 'final';
  // 新ペリアは隠しホールが公開される結果確定まで、ハンデとネットを出せない
  const grossOnly = !final && event.handicapMethod === 'shin-peoria';

  return (
    <Screen>
      <Stack.Screen options={{ title: event.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={styles.eventName}>{event.name}</Text>
          <Muted>
            {event.date} {event.courseName}
          </Muted>
        </View>
        {error ? <Notice tone="warning">最新の情報を読み込めませんでした。</Notice> : null}

        {final ? (
          <>
            <Notice tone="success">結果が確定しました</Notice>
            <AwardResults event={compe} />
            <LeaderboardTable event={compe} />
          </>
        ) : bundle.scoresHidden ? (
          <>
            <Notice tone="info">順位は表彰式で発表されます。</Notice>
            <Progress bundle={bundle} />
            <ProvisionalSpecials event={compe} />
          </>
        ) : (
          <>
            <LeaderboardTable
              event={compe}
              gross={grossOnly}
              footnote={
                grossOnly
                  ? '暫定順位はグロスです。新ペリアのハンデとネットは結果確定後に表示されます。'
                  : 'ホールアウトした人から順位が付きます。'
              }
            />
            <ProvisionalSpecials event={compe} />
          </>
        )}
        <Muted>15秒ごとに自動で更新されます。</Muted>
      </ScrollView>
    </Screen>
  );
}

/** 順位が非公開のときは、各組の進み具合だけ */
function Progress({ bundle }: { bundle: NonNullable<Awaited<ReturnType<typeof api.getEventView>>> }) {
  return (
    <Card>
      <SectionTitle>各組の進み具合</SectionTitle>
      {bundle.groups.map((g) => {
        const members = bundle.players.filter((p) => p.groupId === g.id);
        if (members.length === 0) return null;
        const thru = Math.min(...members.map((p) => p.holesPlayed ?? 0));
        return (
          <View key={g.id} style={styles.row}>
            <Text style={styles.group}>{g.number}組</Text>
            <Text style={{ flex: 1, color: colors.muted }} numberOfLines={1}>
              {members.map((p) => p.name).join('・')}
            </Text>
            <Text style={styles.status}>{g.submittedAt ? 'ホールアウト' : thru === 0 ? '未スタート' : `${thru}H`}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  eventName: { fontSize: 20, fontWeight: '800', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  group: { fontWeight: '700', color: colors.primary, width: 40 },
  status: { fontWeight: '700', color: colors.text },
});
