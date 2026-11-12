import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/index.ts';
import { Button, Card, Muted, Notice, Screen } from '@/components/ui.tsx';
import { takeAfterLogin } from '@/lib/afterLogin.ts';
import { errorMessage } from '@/lib/errors.ts';

/** LINE ログイン後に戻ってくる画面 */
export default function LineCallbackScreen() {
  const { code, state, error } = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const cancelled = !!error || !code || !state;
  const [failure, setFailure] = useState<string | null>(null);
  const message = cancelled ? 'ログインがキャンセルされました。' : failure;

  useEffect(() => {
    if (!code || !state || error) return;
    api
      .completeLineLogin({ code, state })
      .then(() => {
        router.replace((takeAfterLogin() as any) || '/');
      })
      .catch((e) => setFailure(errorMessage(e)));
  }, [code, state, error]);

  return (
    <Screen style={{ padding: 16 }}>
      <View style={{ gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {message ? (
          <>
            <Notice tone="danger">{message}</Notice>
            <Button title="トップへ戻る" onPress={() => router.replace('/')} />
          </>
        ) : (
          <Card>
            <Muted>ログインしています…</Muted>
          </Card>
        )}
      </View>
    </Screen>
  );
}

