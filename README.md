# ゴルフコンペ（Golf-Event-Consultant）

ゴルフコンペの運営アプリ。参加者登録・組分け・スコア入力・新ペリア計算・順位表・表彰までを1つで行えます。

**Expo（React Native + TypeScript + Expo Router）** で作っているため、同じコードで
Web・iOS・Android の3つに対応できます。まずは Web で使い、後からネイティブアプリとしてビルドできます。

## 機能（MVP）

- コンペ作成（コンペ名・開催日・ゴルフ場・ハンデ方式）
- 参加者登録、4名ずつの自動組分け（手動で変更可）
- ホールごとのスコア入力（＋／−で入力、パーとの差を色分け表示）
- ハンデ方式：**新ペリア**（隠しホール12・上限設定可）／申告ハンデ／なし
- 順位表（ネット順、同ネットはハンデの少ない方が上位）
- 表彰：優勝・準優勝・3位・ブービー・ブービーメーカー・ベストグロス・ドラコン・ニアピン
- パー設定（ホールごと）、隠しホールの表示・再抽選
- データは端末内に保存（Web: localStorage / アプリ: AsyncStorage）

### 新ペリアの計算式

```
HC = (隠しホール12ホールの合計打数 × 1.5 − コースのパー) × 0.8
```

- 1ホールの打数はパーの2倍を上限として計算
- HC は 0〜上限（初期値36）、小数第1位
- 隠しホールは前半・後半それぞれ「パー3×1・パー5×1・パー4×4」で抽選

## 開発

```bash
npm install
npm run web          # ブラウザで起動
npm start            # Expo Go（実機）で確認する場合
npm test             # スコア計算ロジックのテスト
npm run typecheck    # 型チェック
npm run build:web    # Web 用の静的ファイルを dist/ に出力
```

## ディレクトリ構成

```
src/
  app/            画面（Expo Router のファイルベースルーティング）
    index.tsx                     コンペ一覧
    events/new.tsx                コンペ作成
    events/[id]/index.tsx         コンペ詳細（順位・スコア・参加者・表彰・設定）
    events/[id]/score/[playerId]  スコア入力
  components/     UI 部品・各タブ
  domain/         型定義・スコア計算（UI に依存しない純粋なロジック＋テスト）
  store/          状態管理と保存（EventRepository で保存先を差し替え可能）
```

## 今後のロードマップ

1. **スコアの共有（クラウド同期）** — 各組の代表がスマホから入力し、全員がリアルタイムで順位を見られるように。
   `src/store/repository.ts` の `EventRepository` を Supabase / Firebase 実装に差し替える想定。
2. 招待リンク・閲覧専用リンク
3. 結果のエクスポート（画像・CSV・LINE 共有）
4. ゴルフ場マスタ（パー情報の自動入力）
5. **iOS / Android アプリ化** — EAS Build でストア配信（`npx eas-cli@latest build`）
