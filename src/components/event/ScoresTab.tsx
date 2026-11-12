import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/index.ts';
import { confirm } from '@/components/confirm.ts';
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

const styles = StyleSheet.create({
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
