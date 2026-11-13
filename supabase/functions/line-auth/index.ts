// LINE ログイン → Supabase のセッション発行（幹事用）
//
// 1. アプリが LINE の認可コードを送ってくる
// 2. LINE でコードをトークンに交換し、ID トークンを LINE に検証してもらう
// 3. LINE のユーザーID（sub）に対応する Supabase ユーザーを用意する
// 4. ログイン用のワンタイムトークン（token_hash）を返す。アプリは verifyOtp でセッションにする
//
// 必要な secrets: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET
// （SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で設定する）
// デプロイ: supabase functions deploy line-auth --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// 管理画面に貼り付けたときに入りがちな前後の空白・改行は取り除く
const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing env ${name}`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const { code, redirectUri, nonce } = await req.json();
    if (typeof code !== 'string' || typeof redirectUri !== 'string' || typeof nonce !== 'string') {
      return json({ error: 'bad request' }, 400);
    }
    const channelId = env('LINE_CHANNEL_ID');

    // 認可コード → トークン
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: env('LINE_CHANNEL_SECRET'),
      }),
    });
    if (!tokenRes.ok) {
      // invalid_client: チャネルID／シークレットの誤り、invalid_grant: コールバックURLの不一致や使用済みのコード
      console.error('line token exchange failed', tokenRes.status, await tokenRes.text());
      return json({ error: 'line token exchange failed' }, 401);
    }
    const { id_token } = await tokenRes.json();

    // ID トークンの検証（署名・有効期限・チャネルID・nonce を LINE が確認する）
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token, client_id: channelId, nonce }),
    });
    if (!verifyRes.ok) {
      console.error('line id token invalid', verifyRes.status, await verifyRes.text());
      return json({ error: 'line id token invalid' }, 401);
    }
    const profile: { sub: string; name?: string; picture?: string } = await verifyRes.json();

    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // LINE ではメールアドレスを受け取らないため、LINE のユーザーIDから内部用のアドレスを作る
    const email = `line-${profile.sub.toLowerCase()}@users.line.invalid`;
    const metadata = { name: profile.name ?? '', picture: profile.picture ?? null, line_sub: profile.sub };

    // 初回だけユーザーを作る（2回目以降は「登録済み」エラーになるので無視）
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
    if (created.error && !/already/i.test(created.error.message)) console.error('create user failed', created.error.message);

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkError || !link.user) {
      console.error('generate link failed', linkError?.message);
      return json({ error: 'session failed' }, 500);
    }

    // LINE の表示名・アイコンが変わっていれば更新
    await admin.auth.admin.updateUserById(link.user.id, { user_metadata: metadata });
    await admin.from('profiles').upsert({
      id: link.user.id,
      display_name: metadata.name,
      avatar_url: metadata.picture,
      updated_at: new Date().toISOString(),
    });

    return json({ token_hash: link.properties.hashed_token });
  } catch (error) {
    console.error(error);
    return json({ error: 'internal error' }, 500);
  }
});
