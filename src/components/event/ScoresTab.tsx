import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '@/api/index.ts';
import { confirm } from '@/components/confirm.ts';
import { AnnouncementList } from '@/components/LiveNotices.tsx';
import { Button, Card, Muted, Notice, SectionTitle, colors } from '@/components/ui.tsx';
import type { OrganizerTabProps } from './types.ts';

/** 組ごとの入力状況、提出の取り消し、結果確定 */
export function ScoresTab({ bundle, run }: OrganizerTabProps) {
  const { event, groups, players, scores } = bundle;
  const activeGroups = groups.filter((g) => players.some((p) => p.groupId === g.id));
  const submitted = activeGroups.filter((g) => g.submittedAt).length;
  const final = event.status === 'final';

  if (activeGroups.length === 0) {
    return (
      <Card>
        <Muted>先に「参加者」タブで参加者と組を登録してください。</Muted>
      </Card>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <AnnouncementComposer bundle={bundle} run={run} />
      <Card>
        <SectionTitle>結果の確定</SectionTitle>
        {final ? (
          <>
            <Notice tone="success">結果を確定しました。閲覧リンクで順位とハンデが公開されています。</Notice>
            <Button
              title="確定を取り消す"
              variant="secondary"
              onPress={() =>
                confirm('結果の確定を取り消しますか？組代表は再び入力できるようになります。', () =>
                  run(() => api.updateEvent(event.id, { status: 'open' })),
                )
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.progress}>
              {activeGroups.length}組中 {submitted}組が提出済み
            </Text>
            <Button
              title="結果を確定する"
              disabled={submitted === 0}
              onPress={() =>
                confirm(
                  submitted < activeGroups.length
                    ? `まだ${activeGroups.length - submitted}組が提出していません。それでも結果を確定しますか？`
                    : '結果を確定しますか？確定すると全員に順位とハンデが公開されます。',
                  () => run(() => api.updateEvent(event.id, { status: 'final' })),
                  '確定',
                )
              }
            />
          </>
        )}
      </Card>

      {activeGroups.map((g) => {
        const members = players.filter((p) => p.groupId === g.id);
        const holes = members.map((p) => scores.filter((s) => s.playerId === p.id).length);
        const thru = Math.min(...holes);
        return (
          <Card key={g.id}>
            <View style={styles.header}>
              <SectionTitle>{g.number}組</SectionTitle>
              <Text style={[styles.badge, g.submittedAt ? styles.badgeDone : null]}>
                {g.submittedAt ? '提出済み' : thru === 0 ? '未スタート' : `${thru}ホール目まで入力`}
              </Text>
            </View>
            <Muted>{members.map((p) => p.name).join('・')}</Muted>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title="スコアを確認・修正"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({ pathname: '/events/[id]/group/[groupId]', params: { id: event.id, groupId: g.id } })
                }
              />
              {g.submittedAt && !final && (
                <Button
                  title="提出を取り消す"
                  variant="ghost"
                  onPress={() =>
                    confirm(`${g.number}組の提出を取り消し、組代表が再び入力できるようにしますか？`, () =>
                      run(() => api.setGroupSubmitted(g.id, false)),
                    )
                  }
                />
              )}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

/** 幹事から全員への連絡（通知を受け取る設定の人に届き、アプリにも表示される） */
function AnnouncementComposer({ bundle, run }: OrganizerTabProps) {
  const [message, setMessage] = useState('');
  const text = message.trim();
  const send = () =>
    confirm(`全員に連絡しますか？\n\n「${text}」`, () => {
      setMessage('');
      void run(() => api.postAnnouncement(bundle.event.id, text));
    }, '送信');
  return (
    <>
      <Card>
        <SectionTitle>📣 全員に連絡</SectionTitle>
        <Muted>閲覧リンク・入力リンクの画面に表示され、通知を受け取る設定の人には通知も届きます。</Muted>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="例：表彰式は17:30から2階レストランです"
          placeholderTextColor={colors.muted}
          maxLength={200}
          multiline
          style={styles.message}
        />
        <Button title="送信" onPress={send} disabled={!text} />
      </Card>
      <AnnouncementList announcements={bundle.announcements} title="送った連絡" />
    </>
  );
}

const styles = StyleSheet.create({
  message: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 64,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  progress: { fontSize: 16, fontWeight: '700', color: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeDone: { backgroundColor: '#FBF6E6', color: '#7A5A0E' },
});
