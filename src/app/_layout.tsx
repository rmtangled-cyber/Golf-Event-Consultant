import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/components/ui.tsx';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'ゴルフコンペ' }} />
        <Stack.Screen name="events/new" options={{ title: '新しいコンペ' }} />
        <Stack.Screen name="events/[id]/index" options={{ title: 'コンペ' }} />
        <Stack.Screen name="events/[id]/group/[groupId]" options={{ title: 'スコア修正' }} />
        <Stack.Screen name="g/[token]" options={{ title: 'スコア入力' }} />
        <Stack.Screen name="v/[token]" options={{ title: '順位' }} />
        <Stack.Screen name="join/[token]" options={{ title: '幹事に参加' }} />
        <Stack.Screen name="auth/line" options={{ title: 'ログイン' }} />
      </Stack>
    </>
  );
}
