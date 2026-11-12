# ゴルフコンペ（Golf-Event-Consultant）

友人・仲間内のゴルフコンペを、みんなのスマホで集計するアプリ。
幹事がコンペを作って組ごとのリンクを配り、各組の代表がスコアを入力すると、順位と新ペリアのハンデが自動で出ます。

**Expo（React Native + TypeScript + Expo Router）** 製。今は Web 版、同じコードで iOS / Android アプリにもできます。
仕様は「ゴルフコンペアプリ サービス仕様書」（Claude Docs）を参照。

## v1 でできること

| 誰が | できること |
| --- | --- |
| 幹事（LINEログイン） | コンペ作成、参加者・組分け、ドラコン・ニアピンのホール設定、リンク配布、スコアの確認・修正、提出の取り消し、結果確定 |
| 組代表（入力リンク・ログイン不要） | 組全員の打数を1ホールずつ入力（パット・OBは任意）、ドラコン・ニアピンの暫定トップ記録、ホールアウト後に提出 |
| 参加者（閲覧リンク・ログイン不要） | 順位・ドラコン・ニアピンを15秒ごとに更新して表示 |

- **電波が弱くても入力できる**：入力はまず端末に保存し、電波が戻ったら自動で送信（`src/sync/outbox.ts`）
- **提出でロック**：提出後は組代表は編集できず、修正は幹事だけ
- **順位の公開**：「プレー中も公開」か「表彰式まで非公開」をコンペごとに選択
- **新ペリア**：隠しホールは結果確定まで幹事以外には非公開。プレー中の閲覧リンクはグロスの暫定順位、確定後にハンデ・ネット・表彰を表示

## 動かしてみる（デモモード）

Supabase を設定しなくても、デモモードで全画面を試せます（データはそのブラウザの中だけに保存）。

```bash
npm install
npm run web
```

## 本番の準備（Supabase + LINE ログイン）

### 1. Supabase

1. [Supabase](https://supabase.com) でプロジェクトを作る（無料枠で可）
2. SQL Editor で `supabase/migrations/20261112000000_init.sql` を実行（または `npx supabase db push`）
3. Project Settings → API の **Project URL** と **anon key** を控える

### 2. LINE ログイン

1. [LINE Developers](https://developers.line.biz/) で「LINEログイン」チャネルを作る（ウェブアプリ）
2. コールバックURLに `https://<公開するドメイン>/auth/line` を登録（開発中は `http://localhost:8081/auth/line` も）
3. **チャネルID** と **チャネルシークレット** を控える
4. LINE とやり取りするサーバー側の関数をデプロイ：

```bash
npx supabase login
npx supabase link --project-ref <プロジェクトID>
npx supabase secrets set LINE_CHANNEL_ID=<チャネルID> LINE_CHANNEL_SECRET=<チャネルシークレット>
npx supabase functions deploy line-auth --no-verify-jwt
```

### 3. アプリの設定

`.env.example` を `.env` にコピーして値を入れる：

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_LINE_CHANNEL_ID=...
```

`EXPO_PUBLIC_` の値はアプリに埋め込まれ、誰でも見られます（anon key とチャネルIDは公開前提の値）。
チャネルシークレットは Supabase の secrets にだけ入れ、`.env` には書かないでください。

### 4. Web に公開

```bash
npm run build:web   # dist/ に出力
```

`dist/` を Vercel・Netlify・Cloudflare Pages などに置きます。どの URL でも `index.html` を返す設定（SPA）にしてください。

## 開発

```bash
npm test             # 順位計算・未送信キューのテスト
npm run typecheck    # 型チェック
npx expo lint        # Lint
# データベースの権限と関数のテスト（ローカルの Postgres 16 が必要）
PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run-local.sh
```

## 構成

```
src/
  app/                      画面（Expo Router）
    index.tsx               トップ（幹事のログイン・コンペ一覧）
    events/new.tsx          コンペ作成
    events/[id]/            幹事のコンペ管理（順位・スコア・参加者・リンク・表彰・設定）
    g/[token].tsx           組の入力リンク
    v/[token].tsx           閲覧リンク
    join/[token].tsx        幹事招待リンク
    auth/line.tsx           LINE ログインからの戻り先
  api/                      バックエンドとの境界（Supabase 実装とデモ実装）
  sync/outbox.ts            電波が弱いとき用の未送信キュー
  domain/                   順位・新ペリアの計算（UI に依存しない）
  components/               画面部品
supabase/
  migrations/               テーブル・権限（RLS）・リンク用の関数
  functions/line-auth/      LINE ログイン → Supabase セッション
  tests/                    migration のテスト
```

### 権限の考え方

- 幹事：`event_organizers` に登録されたコンペだけを、RLS 経由で直接読み書き
- 組代表・閲覧者：テーブルには触れず、リンクのトークンを引数に取る関数（`get_group_input` / `save_group_scores` / `submit_group` / `set_award_winner` / `get_event_view`）だけを呼べる

## v1 に入っていないもの（仕様書のロードマップ）

- 会・会員名簿・年間ランキング・個人成績
- プッシュ通知（ドラコン・ニアピン更新、幹事からの連絡）
- 結果画像・表彰式モード・PDF/CSV
- 9ホールコンペ
- iOS / Android アプリ（アプリ版の LINE ログインは未対応）
