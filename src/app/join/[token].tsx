import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/index.ts';
import { Button, Card, Muted, Notice, Screen, SectionTitle } from '@/components/ui.tsx';
import { useOrganizer } from '@/hooks/useOrganizer.ts';
import { rememberAfterLogin } from '@/lib/afterLogin.ts';
import { errorMessage } from '@/lib/errors.ts';

/** 幹事招待リンク：LINE でログインして、このコンペの幹事に加わる */
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const organizer = useOrganizer();
  const [error, setError] = useState<string | null>(null);

  const join = () =>
    api
      .joinAsOrganizer(token)
      .then((eventId) => router.replace({ pathname: '/events/[id]', params: { id: eventId } }))
      .catch((e) => setError(errorMessage(e)));

  return (
    <Screen style={{ padding: 16 }}>
      <View style={{ gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Card>
          <SectionTitle>幹事として参加</SectionTitle>
          <Muted>このコンペの幹事に招待されています。幹事はLINEでログインして使います。</Muted>
          {organizer ? (
            <Button title={`${organizer.displayName} さんとして参加する`} onPress={join} />
          ) : (
            <Button
              title="LINEでログインして参加"
              onPress={() => {
                rememberAfterLogin(`/join/${token}`);
                api.startLineLogin().catch((e) => setError(errorMessage(e)));
              }}
            />
          )}
        </Card>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </View>
    </Screen>
  );
}
