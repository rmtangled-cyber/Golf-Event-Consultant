import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { confirm } from '@/components/confirm.ts';
import { Button, Card, Muted, Notice, SectionTitle, colors } from '@/components/ui.tsx';
import { withExternalBrowser } from '@/lib/install.ts';
import { absoluteUrl, copyText, shareToLine } from '@/lib/links.ts';
import type { OrganizerTabProps } from './types.ts';

/** 閲覧リンク・組の入力リンク・幹事招待リンクを配る */
export function LinksTab({ bundle, run }: OrganizerTabProps) {
  const { event, groups, players } = bundle;
  const [copied, setCopied] = useState<string | null>(null);
  const activeGroups = groups.filter((g) => players.some((p) => p.groupId === g.id));

  const copy = async (key: string, url: string) => {
    const result = await copyText(url);
    if (result === 'copied') {
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    }
  };

  const viewUrl = withExternalBrowser(absoluteUrl(`/v/${event.viewToken}`));
  const inviteUrl = event.organizerInviteToken ? absoluteUrl(`/join/${event.organizerInviteToken}`) : null;

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <SectionTitle>閲覧リンク（参加者全員へ）</SectionTitle>
        <Muted>順位・ドラコン・ニアピンが見られます。ログインは不要です。</Muted>
        <LinkRow
          url={viewUrl}
          copied={copied === 'view'}
          onCopy={() => copy('view', viewUrl)}
          onLine={() => shareToLine(`【${event.name}】順位はこちら\n${viewUrl}`)}
        />
      </Card>

      <Card>
        <SectionTitle>組の入力リンク（各組の代表へ）</SectionTitle>
        <Muted>このリンクを持つ人だけが、その組のスコアを入力できます。組の代表にだけ送ってください。</Muted>
        {activeGroups.length === 0 && <Notice tone="info">参加者を登録すると、組ごとのリンクができます。</Notice>}
        {activeGroups.map((g) => {
          const url = withExternalBrowser(absoluteUrl(`/g/${g.inputToken}`));
          const names = players.filter((p) => p.groupId === g.id).map((p) => p.name).join('・');
          return (
            <View key={g.id} style={styles.group}>
              <Text style={styles.groupTitle}>
                {g.number}組 <Text style={styles.groupNames}>{names}</Text>
              </Text>
              <LinkRow
                url={url}
                copied={copied === g.id}
                onCopy={() => copy(g.id, url)}
                onLine={() => shareToLine(`【${event.name}】${g.number}組のスコア入力はこちら\n${url}`)}
              />
              <Button
                title="リンクを作り直す（前のリンクは使えなくなります）"
                variant="ghost"
                onPress={() =>
                  confirm(`${g.number}組の入力リンクを作り直しますか？前のリンクは使えなくなります。`, () =>
                    run(() => api.regenerateGroupToken(g.id)),
                  )
                }
              />
            </View>
          );
        })}
      </Card>

      {inviteUrl && (
        <Card>
          <SectionTitle>幹事招待リンク</SectionTitle>
          <Muted>一緒に運営する人に送ると、LINEでログインしてこのコンペの幹事になれます。</Muted>
          <LinkRow
            url={inviteUrl}
            copied={copied === 'invite'}
            onCopy={() => copy('invite', inviteUrl)}
            onLine={() => shareToLine(`【${event.name}】幹事として参加してください\n${inviteUrl}`)}
          />
        </Card>
      )}
    </View>
  );
}

function LinkRow({ url, copied, onCopy, onLine }: { url: string; copied: boolean; onCopy: () => void; onLine: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="LINEで送る" onPress={onLine} style={{ flex: 1, backgroundColor: '#06C755' }} />
        <Button title={copied ? 'コピーしました' : 'コピー'} variant="secondary" onPress={onCopy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  url: {
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.bg,
    padding: 8,
    borderRadius: 6,
  },
  group: { gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  groupTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  groupNames: { fontSize: 13, fontWeight: '400', color: colors.muted },
});
