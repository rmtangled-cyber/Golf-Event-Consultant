import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/components/ui.tsx';
import { EventsProvider } from '@/store/EventsContext.tsx';

export default function RootLayout() {
  return (
    <EventsProvider>
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
        <Stack.Screen name="events/new" options={{ title: '新しいコンペ', presentation: 'modal' }} />
        <Stack.Screen name="events/[id]/index" options={{ title: 'コンペ' }} />
        <Stack.Screen name="events/[id]/score/[playerId]" options={{ title: 'スコア入力' }} />
      </Stack>
    </EventsProvider>
  );
}
