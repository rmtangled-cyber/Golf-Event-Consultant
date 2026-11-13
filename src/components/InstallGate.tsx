import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Notice, Screen, colors } from '@/components/ui.tsx';
import { canPromptInstall, installMode, isIosDevice, promptInstall, withExternalBrowser } from '@/lib/install.ts';
import type { InstallMode } from '@/lib/install.ts';

const doneKey = (path: string) => `golf-compe/install-guide/${path}`;

/**
 * スマホで初めてリンクを開いたとき、本題の前に「ブラウザで開く → ホーム画面に追加」を案内する。
 * 「あとで」を押すか、ホーム画面のアイコンから開けば、次からは出ない。
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [mode] = useState(installMode);
  // この画面で案内を済ませたか（確認中は null）
  const [done, setDone] = useState<boolean | null>(mode ? null : true);

  useEffect(() => {
    if (!mode) return;
    AsyncStorage.getItem(doneKey(path))
      .then((v) => setDone(!!v))
      .catch(() => setDone(false));
  }, [mode, path]);

  if (done === null) return <Screen />;
  if (done || !mode) return <>{children}</>;

  const skip = () => {
    void AsyncStorage.setItem(doneKey(path), '1');
    setDone(true);
  };
  return <InstallGuide mode={mode} onSkip={skip} />;
}

function InstallGuide({ mode, onSkip }: { mode: Exclude<InstallMode, null>; onSkip: () => void }) {
  const ios = mode === 'ios' || (mode === 'in-app' && isIosDevice());
  const [message, setMessage] = useState<string | null>(null);

  const openInBrowser = () => {
    window.location.href = withExternalBrowser(window.location.href.replace(/[?&]openExternalBrowser=1/, ''));
  };

  const addSteps = ios
    ? [
        'Safariの画面下にある共有ボタン（□に↑）を押す',
        '下にスクロールして「ホーム画面に追加」を選び、右上の「追加」を押す',
        'ホーム画面にできた「Golf Event」のアイコンから開く',
      ]
    : [
        'Chromeの右上の「︙」を押す',
        '「ホーム画面に追加」（または「アプリをインストール」）を選ぶ',
        'ホーム画面にできた「Golf Event」のアイコンから開く',
      ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>はじめに</Text>
        <Text style={styles.title}>ホーム画面に追加して使いましょう</Text>
        <Card>
          <Benefit icon="🔔" text="ドラコン更新や幹事からの連絡が、通知で届きます" />
          <Benefit icon="⛳" text="次からはアイコン1つで、この画面がすぐ開きます" />
          {ios && <Muted>iPhoneでは、ホーム画面に追加しないと通知が届きません。</Muted>}
        </Card>

        {mode === 'in-app' && (
          <Card>
            <StepTitle no={1} text="ブラウザで開く" />
            <Muted>LINEなどのアプリの中では、ホーム画面に追加できません。</Muted>
            <Button title={ios ? 'Safariで開く' : 'ブラウザで開く'} onPress={openInBrowser} />
            <Muted>
              開かないときは、画面の右下か右上の「︙」や共有ボタンから「{ios ? 'Safariで開く' : 'ブラウザで開く'}」を選んでください。
            </Muted>
          </Card>
        )}

        <Card>
          <StepTitle no={mode === 'in-app' ? 2 : 1} text="ホーム画面に追加する" />
          {mode === 'android' && canPromptInstall() ? (
            <Button
              title="ホーム画面に追加"
              onPress={() =>
                void promptInstall().then((ok) =>
                  setMessage(ok ? '追加しました。ホーム画面の「Golf Event」のアイコンから開いてください。' : null),
                )
              }
            />
          ) : (
            addSteps.map((text, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))
          )}
          {message ? <Notice tone="success">{message}</Notice> : null}
        </Card>

        <Button title="あとで（このまま使う）" variant="ghost" onPress={onSkip} />
      </ScrollView>
    </Screen>
  );
}

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefit}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function StepTitle({ no, text }: { no: number; text: string }) {
  return (
    <Text style={styles.stepTitle}>
      ステップ{no}　{text}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 2, fontSize: 13 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  stepTitle: { fontSize: 17, fontWeight: '800', color: colors.primaryDark },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    fontSize: 13,
    overflow: 'hidden',
  },
  stepText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 24 },
});
