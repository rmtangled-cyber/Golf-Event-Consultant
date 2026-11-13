import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '@/components/ui.tsx';
import { registerServiceWorker } from '@/lib/push.ts';

export default function RootLayout() {
  // プッシュ通知を表示するための Service Worker（Web のみ）
  useEffect(registerServiceWorker, []);

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
        <Stack.Screen name="index" options={{ title: 'Golf Event Consultant' }} />
        <Stack.Screen name="events/new" options={{ title: '新しいコンペ' }} />
        <Stack.Screen name="events/[id]/index" options={{ title: 'コンペ' }} />
        <Stack.Screen name="events/[id]/group/[groupId]" options={{ title: 'スコア修正' }} />
        <Stack.Screen name="events/[id]/ceremony" options={{ title: '表彰式', headerShown: false }} />
        <Stack.Screen name="events/[id]/print" options={{ title: '印刷', headerShown: false }} />
        <Stack.Screen name="g/[token]" options={{ title: 'スコア入力' }} />
        <Stack.Screen name="v/[token]" options={{ title: '順位' }} />
        <Stack.Screen name="join/[token]" options={{ title: '幹事に参加' }} />
        <Stack.Screen name="auth/line" options={{ title: 'ログイン' }} />
      </Stack>
    </>
  );
}
