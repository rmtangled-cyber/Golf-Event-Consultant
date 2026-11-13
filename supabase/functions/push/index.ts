// プッシュ通知（Web）を送る関数
//
// action:
//   vapid        … 通知の署名に使う公開鍵を返す（初回に鍵を自動で作り、データベースに保存する）
//   award        … ドラコン・ニアピンの暫定トップが変わっていたら通知する
//   announcement … 幹事からの連絡を通知する（1回だけ）
//
// どの action も「データベースの実際の変化」だけを通知し、同じ内容は二度送らない。
// そのため呼び出し元の認証は不要（JWT の確認はオフにしてデプロイする）。
// 必要な secrets: なし（SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で設定する）

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!.trim(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!.trim(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** 通知の署名に使う鍵。なければ作って保存する */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const read = async () => {
    const { data, error } = await admin.from('app_secrets').select('name, value').in('name', ['vapid_public', 'vapid_private']);
    if (error) throw error;
    const map = Object.fromEntries((data ?? []).map((r) => [r.name, r.value]));
    return map.vapid_public && map.vapid_private ? { publicKey: map.vapid_public, privateKey: map.vapid_private } : null;
  };
  const existing = await read();
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  // 同時に作られた場合に備えて、先に保存された方を使う
  await admin.from('app_secrets').upsert(
    [
      { name: 'vapid_public', value: keys.publicKey },
      { name: 'vapid_private', value: keys.privateKey },
    ],
    { onConflict: 'name', ignoreDuplicates: true },
  );
  return (await read())!;
}

interface Payload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** コンペの通知を受け取る設定の端末に送る。使えなくなった宛先は消す */
async function sendToEvent(eventId: string, topic: 'drive_pin' | 'announcements', payload: Payload, subject: string) {
  const { publicKey, privateKey } = await vapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('event_id', eventId)
    .eq(topic, true);
  if (error) throw error;

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('push failed', status, (e as Error).message);
      }
    }),
  );
  return sent;
}

async function notifyAward(awardId: string, subject: string) {
  const { data: award } = await admin
    .from('special_awards')
    .select('id, event_id, kind, hole, note, winner_player_id, notified_winner_id')
    .eq('id', awardId)
    .maybeSingle();
  if (!award?.winner_player_id || award.winner_player_id === award.notified_winner_id) return 0;

  // 先に「通知済み」に更新できた呼び出しだけが送る（同時に呼ばれても1回だけ）
  let claim = admin.from('special_awards').update({ notified_winner_id: award.winner_player_id }).eq('id', award.id);
  claim = award.notified_winner_id ? claim.eq('notified_winner_id', award.notified_winner_id) : claim.is('notified_winner_id', null);
  const { data: claimed } = await claim.select('id');
  if (!claimed?.length) return 0;

  const [{ data: player }, { data: event }] = await Promise.all([
    admin.from('players').select('name, groups(number)').eq('id', award.winner_player_id).maybeSingle(),
    admin.from('events').select('view_token, status').eq('id', award.event_id).single(),
  ]);
  if (!player || !event || event.status !== 'open') return 0;
  const group = (player as { groups?: { number: number } | null }).groups?.number;
  const label = award.kind === 'drive' ? 'ドラコン' : 'ニアピン';
  return sendToEvent(
    award.event_id,
    'drive_pin',
    {
      title: `🏆 ${label}更新！`,
      body: `${award.hole}番：${group ? `${group}組の` : ''}${player.name}さんが暫定トップ${award.note ? `（${award.note}）` : ''}`,
      url: `/v/${event.view_token}`,
      tag: `award-${award.id}`,
    },
    subject,
  );
}

async function notifyAnnouncement(announcementId: string, subject: string) {
  // まだ送っていない連絡だけを「送信済み」にして送る
  const { data: rows } = await admin
    .from('announcements')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', announcementId)
    .is('sent_at', null)
    .select('id, event_id, message');
  const ann = rows?.[0];
  if (!ann) return 0;
  const { data: event } = await admin.from('events').select('name, view_token').eq('id', ann.event_id).single();
  if (!event) return 0;
  return sendToEvent(
    ann.event_id,
    'announcements',
    { title: `📣 ${event.name}`, body: ann.message, url: `/v/${event.view_token}`, tag: `announcement-${ann.id}` },
    subject,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const body = await req.json();
    // 通知の送り主として、アプリの URL を名乗る（Apple などの通知サービスが確認する）
    const origin = req.headers.get('origin');
    const subject =
      origin?.startsWith('https://') ? origin : (Deno.env.get('APP_URL')?.trim() || 'https://golf-event-consultant.vercel.app');

    switch (body?.action) {
      case 'vapid':
        return json({ publicKey: (await vapidKeys()).publicKey });
      case 'award':
        if (typeof body.awardId !== 'string') return json({ error: 'bad request' }, 400);
        return json({ sent: await notifyAward(body.awardId, subject) });
      case 'announcement':
        if (typeof body.announcementId !== 'string') return json({ error: 'bad request' }, 400);
        return json({ sent: await notifyAnnouncement(body.announcementId, subject) });
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (error) {
    console.error(error);
    return json({ error: 'internal error' }, 500);
  }
});
