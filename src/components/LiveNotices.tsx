import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AnnouncementInfo, AwardInfo } from '@/api/types.ts';
import { Card, Muted, SectionTitle, colors } from '@/components/ui.tsx';

interface Props {
  awards: AwardInfo[];
  announcements: AnnouncementInfo[];
  players: { id: string; name: string; groupId: string | null }[];
  groups?: { id: string; number: number }[];
}

/**
 * アプリを開いている人向けのお知らせ（通知を許可していない人にも届く）。
 * 前回読み込んだときから、暫定トップが変わった・新しい連絡が来たら画面上部に出す。
 */
export function LiveBanner({ awards, announcements, players, groups }: Props) {
  const [messages, setMessages] = useState<{ id: string; text: string }[]>([]);
  const prev = useRef<{ winners: Map<string, string | null>; announcements: Set<string> } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 画面を離れたら、消すためのタイマーも止める
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const winners = new Map(awards.map((a) => [a.id, a.winnerPlayerId]));
    const announcementIds = new Set(announcements.map((a) => a.id));
    const before = prev.current;
    prev.current = { winners, announcements: announcementIds };
    if (!before) return; // 最初の読み込みでは出さない

    const fresh: { id: string; text: string }[] = [];
    for (const a of awards) {
      if (!a.winnerPlayerId || before.winners.get(a.id) === a.winnerPlayerId) continue;
      const p = players.find((pl) => pl.id === a.winnerPlayerId);
      const g = groups?.find((gr) => gr.id === p?.groupId);
      fresh.push({
        id: `${a.id}-${a.winnerPlayerId}`,
        text: `🏆 ${a.kind === 'drive' ? 'ドラコン' : 'ニアピン'}更新！ ${a.hole}番：${g ? `${g.number}組の` : ''}${p?.name ?? ''}さん${a.note ? `（${a.note}）` : ''}`,
      });
    }
    for (const n of announcements) {
      if (!before.announcements.has(n.id)) fresh.push({ id: n.id, text: `📣 幹事より：${n.message}` });
    }
    if (fresh.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 読み込んだデータの変化をお知らせとして出す
    setMessages((m) => [...fresh, ...m.filter((x) => !fresh.some((f) => f.id === x.id))].slice(0, 3));
    // 30秒で消す（次の読み込みで取り消されないよう、タイマーは別に持つ）
    const ids = new Set(fresh.map((f) => f.id));
    timers.current.push(setTimeout(() => setMessages((m) => m.filter((x) => !ids.has(x.id))), 30_000));
  }, [awards, announcements, players, groups]);

  if (messages.length === 0) return null;
  return (
    <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
      {messages.map((m) => (
        <View key={m.id} style={styles.banner}>
          <Text style={styles.bannerText}>{m.text}</Text>
        </View>
      ))}
    </View>
  );
}

const time = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 幹事からの連絡（新しい順） */
export function AnnouncementList({ announcements, title = '幹事からの連絡' }: { announcements: AnnouncementInfo[]; title?: string }) {
  if (announcements.length === 0) return null;
  return (
    <Card>
      <SectionTitle>📣 {title}</SectionTitle>
      {announcements.map((a, i) => (
        <View key={a.id} style={[styles.row, i === 0 && styles.latest]}>
          <Text style={styles.time}>{time(a.createdAt)}</Text>
          <Text style={[styles.message, i === 0 && { fontWeight: '700' }]}>{a.message}</Text>
        </View>
      ))}
      <Muted>最新の5件まで表示します。</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  latest: { borderTopWidth: 0 },
  time: { color: colors.muted, fontVariant: ['tabular-nums'], width: 42 },
  message: { flex: 1, color: colors.text, fontSize: 15 },
});
