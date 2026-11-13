import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, Muted, Notice, SectionTitle } from '@/components/ui.tsx';
import { resultsCsv } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';
import { renderResultImage } from '@/lib/resultImage.ts';
import { csvBlob, safeFileName, shareOrDownload } from '@/lib/share.ts';

/** 結果の共有：表彰式モード・結果画像・印刷/PDF・CSV（幹事は全部、閲覧リンクは画像だけ） */
export function ResultActions({ event, organizer }: { event: CompeEvent; organizer?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const web = Platform.OS === 'web';
  const base = safeFileName(`${event.date}_${event.name}`);

  const run = async (key: string, fn: () => Promise<'shared' | 'downloaded'>, done: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await fn();
      if (result === 'downloaded') setMessage({ tone: 'success', text: done });
    } catch (e) {
      setMessage({ tone: 'danger', text: (e as Error).message || '保存できませんでした' });
    }
    setBusy(null);
  };

  return (
    <Card>
      <SectionTitle>結果の共有</SectionTitle>
      {!web && <Muted>画像・CSV・印刷はWeb版で使えます。</Muted>}
      <View style={{ gap: 8 }}>
        {organizer && (
          <Button
            title="🏆 表彰式モード"
            onPress={() => router.push({ pathname: '/events/[id]/ceremony', params: { id: event.id } })}
          />
        )}
        <Button
          title={busy === 'image' ? '画像を作っています…' : '結果画像を保存・共有'}
          variant="secondary"
          disabled={!web || !!busy}
          onPress={() =>
            run(
              'image',
              async () => shareOrDownload(await renderResultImage(event), `${base}.png`, event.name),
              '画像を保存しました。',
            )
          }
        />
        {organizer && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="印刷・PDF"
              variant="secondary"
              disabled={!web}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/events/[id]/print', params: { id: event.id } })}
            />
            <Button
              title="CSV（Excel）"
              variant="secondary"
              disabled={!web || !!busy}
              style={{ flex: 1 }}
              onPress={() =>
                run('csv', async () => shareOrDownload(csvBlob(resultsCsv(event)), `${base}.csv`, event.name), 'CSVを保存しました。')
              }
            />
          </View>
        )}
      </View>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Card>
  );
}
