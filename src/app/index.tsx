import { Link, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, colors } from '@/components/ui.tsx';
import { isComplete } from '@/domain/scoring.ts';
import { useEvents } from '@/store/EventsContext.tsx';

export default function EventListScreen() {
  const { events, ready } = useEvents();

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={[...events].sort((a, b) => b.date.localeCompare(a.date))}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <Button title="＋ 新しいコンペを作成" onPress={() => router.push('/events/new')} />
        }
        ListEmptyComponent={
          ready ? (
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 40 }}>⛳</Text>
              <Text style={styles.emptyTitle}>まだコンペがありません</Text>
              <Muted>コンペを作成して参加者とスコアを管理しましょう</Muted>
            </Card>
          ) : undefined
        }
        renderItem={({ item }) => {
          const finished = item.players.filter((p) => isComplete(item.scores[p.id])).length;
          return (
            <Link href={{ pathname: '/events/[id]', params: { id: item.id } }} asChild>
              <Pressable>
                <Card>
                  <View style={styles.row}>
                    <Text style={styles.date}>{item.date}</Text>
                    <Text style={styles.badge}>
                      {finished}/{item.players.length}人 ホールアウト
                    </Text>
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.courseName ? <Muted>{item.courseName}</Muted> : null}
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: colors.primary, fontWeight: '700' },
  badge: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
