import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PushPrefs } from '@/api/types.ts';
import { Button, Card, Muted, Notice, SectionTitle, colors } from '@/components/ui.tsx';
import { loadPushPrefs, pushSupport, subscribePush, unsubscribePush } from '@/lib/push.ts';

const GUIDE_CLOSED_KEY = 'golf-compe/push-guide-closed';
const DEFAULT_PREFS: PushPrefs = { drivePin: true, announcements: true };

/**
 * 通知の設定。iPhone でホーム画面に追加していない人には、追加の手順を案内する。
 * （ネイティブアプリを公開したら、アプリのダウンロード案内に置き換える）
 */
export function NotificationPanel({ viewToken }: { viewToken: string }) {
  const [support] = useState(pushSupport);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [draft, setDraft] = useState<PushPrefs>(DEFAULT_PREFS);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPushPrefs(viewToken).then((p) => {
      setPrefs(p);
      if (p) setDraft(p);
    });
    void AsyncStorage.getItem(GUIDE_CLOSED_KEY).then((v) => v && setOpen(false));
  }, [viewToken]);

  if (support === 'unsupported') return null;

  const close = () => {
    setOpen(false);
    void AsyncStorage.setItem(GUIDE_CLOSED_KEY, '1');
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={styles.collapsed} accessibilityRole="button">
        <Text style={styles.collapsedText}>{prefs ? '🔔 通知：受け取る設定です' : '🔔 ドラコン更新などを通知で受け取る'}</Text>
        <Text style={styles.collapsedLink}>設定</Text>
      </Pressable>
    );
  }

  const save = async (next: PushPrefs) => {
    setBusy(true);
    setError(null);
    try {
      await subscribePush(viewToken, next);
      setPrefs(next);
      setDraft(next);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await unsubscribePush(viewToken);
      setPrefs(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Card>
      <View style={styles.header}>
        <SectionTitle>🔔 通知</SectionTitle>
        <Pressable onPress={close} hitSlop={8}>
          <Text style={styles.later}>{prefs ? '閉じる' : 'あとで'}</Text>
        </Pressable>
      </View>

      {support === 'in-app-browser' && (
        <>
          <Muted>LINEなどのアプリの中で開いています。通知を受け取るには、ブラウザで開き直してください。</Muted>
          <Steps
            items={[
              '画面の右上（または右下）の「︙」や共有ボタンを押す',
              '「Safariで開く」（Androidは「ブラウザで開く」）を選ぶ',
              '開いた画面のこの欄から、通知の設定に進む',
            ]}
          />
        </>
      )}

      {support === 'ios-needs-install' && (
        <>
          <Muted>iPhoneでは、ホーム画面に追加すると通知が届きます。</Muted>
          <Steps
            items={[
              'Safariの画面下の共有ボタン（□に↑）を押す',
              '「ホーム画面に追加」を選び、「追加」を押す',
              'ホーム画面にできた「Golf Event」のアイコンから開き直す',
              '開いた画面のこの欄で「通知を受け取る」を押す',
            ]}
          />
        </>
      )}

      {support === 'supported' && (
        <>
          <Muted>受け取る通知を選んでください。</Muted>
          <Check
            label="ドラコン・ニアピンの暫定トップ更新"
            value={draft.drivePin}
            onChange={(drivePin) => (prefs ? save({ ...draft, drivePin }) : setDraft({ ...draft, drivePin }))}
          />
          <Check
            label="幹事からの連絡"
            value={draft.announcements}
            onChange={(announcements) =>
              prefs ? save({ ...draft, announcements }) : setDraft({ ...draft, announcements })
            }
          />
          {prefs ? (
            <>
              <Notice tone="success">この端末で通知を受け取ります。</Notice>
              <Button title="通知をやめる" variant="ghost" onPress={stop} disabled={busy} />
            </>
          ) : (
            <Button
              title={busy ? '設定しています…' : '通知を受け取る'}
              onPress={() => save(draft)}
              disabled={busy || (!draft.drivePin && !draft.announcements)}
            />
          )}
        </>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((text, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNo}>{i + 1}</Text>
          <Text style={styles.stepText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.check}
    >
      <View style={[styles.box, value && styles.boxOn]}>{value && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  later: { color: colors.muted, fontSize: 14 },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapsedText: { flex: 1, color: colors.text, fontSize: 14 },
  collapsedLink: { color: colors.primary, fontWeight: '700' },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '800',
    fontSize: 13,
    overflow: 'hidden',
  },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
