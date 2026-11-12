import { Link, router } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { Button, Card, Muted, Notice, Screen, colors } from '@/components/ui.tsx';
import { useLoader } from '@/hooks/useLoader.ts';
import { useOrganizer } from '@/hooks/useOrganizer.ts';
import { errorMessage } from '@/lib/errors.ts';
import { useState } from 'react';

export default function HomeScreen() {
  const organizer = useOrganizer();
  const [loginError, setLoginError] = useState<string | null>(null);
  const { data: events, error } = useLoader(
    () => (organizer ? api.listMyEvents() : Promise.resolve([])),
    [organizer?.id],
  );

  const demoNotice =
    api.mode === 'demo' ? (
      <Notice tone="warning">デモモードです。データはこの端末の中だけに保存されます。</Notice>
    ) : null;

  if (organizer === undefined) return <Screen />;

  if (!organizer) {
    return (
      <Screen>
        <View style={styles.container}>
          {demoNotice}
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 44 }}>⛳</Text>
            <Text style={styles.heroTitle}>ゴルフコンペの集計を、みんなのスマホで</Text>
            <Muted>組ごとにスコアを入力すると、順位と新ペリアのハンデを自動で計算します。</Muted>
          </Card>
          <Card>
            <Text style={styles.label}>幹事の方</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => api.startLineLogin().catch((e) => setLoginError(errorMessage(e)))}
              style={({ pressed }) => [styles.lineButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.lineButtonText}>LINEでログイン</Text>
            </Pressable>
            {loginError ? <Notice tone="danger">{loginError}</Notice> : null}
          </Card>
          <Card>
            <Text style={styles.label}>参加者・組代表の方</Text>
            <Muted>ログインは不要です。幹事から届いたリンクを開いてください。</Muted>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.container}
        data={events ?? []}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {demoNotice}
            <View style={styles.profile}>
              {organizer.avatarUrl ? <Image source={{ uri: organizer.avatarUrl }} style={styles.avatar} /> : null}
              <Text style={styles.profileName}>{organizer.displayName} さん（幹事）</Text>
              <Pressable onPress={() => api.signOut()} hitSlop={8}>
                <Text style={{ color: colors.muted }}>ログアウト</Text>
              </Pressable>
            </View>
            <Button title="＋ 新しいコンペを作成" onPress={() => router.push('/events/new')} />
            {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
          </View>
        }
        ListEmptyComponent={
          events ? (
            <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={styles.heroTitle}>まだコンペがありません</Text>
              <Muted>コンペを作成して、参加者と組を登録しましょう。</Muted>
            </Card>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/events/[id]', params: { id: item.id } }} asChild>
            <Pressable>
              <Card>
                <View style={styles.row}>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={[styles.badge, item.status === 'final' && styles.badgeFinal]}>
                    {item.status === 'final' ? '結果確定' : '開催中'}
                  </Text>
                </View>
                <Text style={styles.name}>{item.name}</Text>
                {item.courseName ? <Muted>{item.courseName}</Muted> : null}
              </Card>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center', marginVertical: 4 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineButton: { backgroundColor: '#06C755', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  lineButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  profileName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
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
  badgeFinal: { backgroundColor: '#FBF6E6', color: '#7A5A0E' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
});
