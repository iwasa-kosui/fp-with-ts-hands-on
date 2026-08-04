# 関数型ドメインモデリングハンズオン with TypeScript 設計書

## 目的

2026-08-30 の connpass イベント「関数型ドメインモデリングハンズオン with TypeScript」で使う example と、参加者が当日に参照するドキュメントサイトを、この `fp-with-ts-hands-on` リポジトリに新規構築する。

成果物は次の2つ。

- 参加者が clone して `pnpm install` / `pnpm test` で進められる TypeScript example
- 動物病院をイメージした、動物だらけのかわいいドキュメントサイト

特定のドキュメント生成ツールは使わず、Vite で生成した静的 assets を Cloudflare Workers の Static Assets として配信する。Worker は将来の API やリダイレクトを置ける薄い入口に留める。

## イベント制約

イベントページ PDF から読み取れる前提は次の通り。

- 開催日時: 2026-08-30 15:00-18:00
- 対象: TypeScript 初級から中級。基本文法が書ければ参加可能
- 事前準備: Node.js、pnpm、GitHub から clone できる環境
- 題材: 動物病院の予約・カルテ管理システム
- 学ぶ項目: 壊れやすい状態表現、Discriminated Union、純粋関数、スキーマライブラリ、Always-Valid Domain Model、Branded Type、Result 型、AI エージェントへの設計原則の伝え方
- タイムテーブル:
  - 0:00-0:10 オープニング
  - 0:10-0:30 壊れやすい動物病院アプリを読む
  - 0:30-1:10 Discriminated Union で状態遷移を型にする
  - 1:10-1:20 休憩
  - 1:20-1:55 Zod と Branded Type で境界と ID を守る
  - 1:55-2:30 Result 型でエラー処理を整理する
  - 2:30-2:50 AI エージェント時代の設計原則
  - 2:50-3:00 まとめ、質疑応答

## 既存ドラフトからの変更

`monorepo/apps/kosui-me/src/content/books/animal-clinic` のドラフトは、長編教材「育てる TypeScript アプリケーション」の書籍構想としては有用だが、今回の3時間イベントには重い。第0章と第1章は密度がある一方、第2章以降は見出しレベルで止まっている。

今回の成果物では、長編の第0-6章 + 最終章をそのまま移植しない。イベントのお品書きに合わせ、ハンズオンを4 module + 横断レビューに圧縮する。

- `00-break-the-app`: 小さな仕様変更で壊れやすい実装に事故を起こす
- `01-state-modeling`: Discriminated Union と純粋関数で状態遷移を表現する
- `02-boundary-and-ids`: Zod と Branded Type で外部入力と ID を守る。Result の設計説明はここでは扱わない
- `03-result-errors`: Result 型でエラー処理を整理する
- `04-agent-review`: 同じ仕様変更を AI エージェントに頼む前提で、各 module で得た設計原則をレビュー観点に変換する

Sensitive 型やログ redact、ドメインイベント、レイヤードアーキテクチャは当日の手を動かす範囲から外す。ログ漏えいの種を legacy app に残す場合は、AI Agent Review で「今回扱わなかった境界」として明確に回収する。

## 体験設計

全 module は、ひとつの事故「会計済みの来院が診察中に戻る」を追いかける。参加者はまず legacy app に小さな仕様変更を入れて事故を起こし、その後の module で同じ事故を別の層から封じ込めていく。

- 状態遷移: `Paid` や `Canceled` から戻れない形を型で表現する
- 境界と ID: 外部入力や ID 取り違えによって不正な状態が混入しないようにする
- Result: 失敗を `throw` や握りつぶしではなく、呼び出し元が読める値として返す
- AI Agent Review: 同じ仕様変更を AI エージェントへ依頼するとき、何を指示し、何をレビューすべきかを各 module で確認する

各 module の docs は `Incident -> Red -> Edit -> Green -> Agent Review` の固定フォーマットにする。最後の AI module で初めて設計原則を出すのではなく、各 module の最後に小さな Agent Review を置き、最後は総集編にする。

参加者が書くコードは各 module 1〜2関数に制限する。残りは穴埋め済み、または講師が解説する worked example として置く。発展課題は optional とし、3時間の本線から外す。

## 改訂後の当日フロー

connpass の大枠は維持しつつ、実際の進行は「読む」からではなく「事故を起こす」から始める。

- 0:00-0:10 オープニング: 今日のゴールを「AI に変更を頼んでも壊れにくい動物病院ドメインにする」と置く
- 0:10-0:25 事故を起こす: legacy app に小さな仕様変更を入れ、`paid -> in-examination` が起きる赤いテストを見る
- 0:25-0:40 事故を読む: `status: string`、optional fields、`throw`、丸ごとログを確認し、欠けている不変条件を書き出す
- 0:40-1:10 Discriminated Union で状態遷移を閉じる: `checkIn` と `startExamination` だけ参加者が実装し、`Paid` から戻れないことを型で確認する
- 1:10-1:20 休憩
- 1:20-1:45 Zod と Branded Type で外部入力を止める: 参加者が書くのは `PetId.safeParse` と検査結果 payload parse に絞る
- 1:45-2:15 Result 型で失敗を見える形にする: `ValidationError | AppointmentNotFound | InvalidAppointmentState` を値として読む
- 2:15-2:35 AI エージェントに同じ変更を頼む前提でレビューする: どこが型で守られ、どこは人間のレビューが必要か確認する
- 2:35-2:50 ミニ総合演習: 新しい仕様を1つ追加し、型エラー・テスト・Result のどれで守られるかを確認する
- 2:50-3:00 まとめ、質疑応答

## 推奨アプローチ

単一 pnpm workspace に docs site と example package を同居させる。

```text
.
├── package.json
├── pnpm-workspace.yaml
├── wrangler.jsonc
├── apps/
│   └── docs/
│       ├── index.html
│       ├── src/
│       │   ├── main.ts
│       │   ├── content/
│       │   ├── components/
│       │   └── styles/
│       └── vite.config.ts
├── packages/
│   └── clinic-example/
│       ├── src/
│       ├── exercises/
│       ├── test/
│       └── README.md
├── worker/
│   └── index.ts
└── docs/
    └── event/
```

この構成を選ぶ理由は、参加者の導線が単純になるため。1つの repo を clone すれば、ドキュメントも example も同じ commit で揃う。Cloudflare Workers への配信も `pnpm build` 後の `apps/docs/dist` を `assets.directory` に指定すればよい。

採用しない案:

- 既存 `growing-ts-apps-animal-clinic` を継続して docs だけこの repo に置く: 当日の案内が2 repo に割れ、タグや章番号の同期が壊れやすい
- docs と example を完全分離する: 将来的な教材シリーズ化には向くが、今回のイベントでは setup の失敗点が増える

## Example 設計

example は CLI や DB を持たない。中心は TypeScript のドメインコードと Vitest のテストに置く。

`packages/clinic-example/src` は次の境界に分ける。

- `shared/result.ts`: 軽量 Result 型。イベントでは `neverthrow` などの外部 API 学習に時間を使わない
- `shared/schema-result.ts`: Zod の `safeParse` を Result に変換する helper
- `shared/assert-never.ts`: 網羅性チェック
- `clinic/appointment-id.ts`, `clinic/pet-id.ts`, `clinic/owner-id.ts`, `clinic/veterinarian-id.ts`: Zod brand を持つ ID companion object
- `clinic/appointment.ts`: `kind` を discriminant にした予約状態の Discriminated Union と遷移関数
- `clinic/exam-result.ts`: 外部検査機関 API の入力スキーマと domain 変換
- `clinic/appointment-repository.ts`: インメモリ repository。関数プロパティ記法で定義する
- `clinic/use-cases.ts`: 参加者が Result 合成を読む場所

状態は次に絞る。

- `Scheduled`
- `CheckedIn`
- `InExamination`
- `Paid`
- `Canceled`

有効な遷移は `Scheduled -> CheckedIn -> InExamination -> Paid`、および `Scheduled | CheckedIn -> Canceled`。`Paid` と `Canceled` は終端。

既存 `growing-ts-apps-animal-clinic` の `step-00-end` / `step-01-end` は seed として使うが、そのまま持ち込まない。今回のルールに合わせ、`status` ではなく `kind`、catch-all `types.ts` ではなく1概念1ファイルへ整える。

## Exercise 設計

参加者が迷わないよう、各 module は `Incident -> Red -> Edit -> Green -> Agent Review` の単位にする。

- `00-break-the-app`
  - 通常の `pnpm test` は緑にする
  - 参加者は `pnpm --filter @fp-with-ts/clinic-example exercise:00` で赤い事故テストを起こす
  - legacy app に「再診察を開始する」小さな仕様変更を入れ、`paid -> in-examination` が起きることを確認する
  - `status: string`、optional fields、`throw`、丸ごとログ出力を読み、どの不変条件がコードにないかを言語化する
- `01-state-modeling`
  - `kind` の Discriminated Union を導入済みの partially completed code を埋める
  - 参加者が実装するのは `Appointment.checkIn` と `Appointment.startExamination` の2関数に絞る
  - `@ts-expect-error` は typecheck 専用セクションとして扱い、「エラーが出ることを確認するテスト」であると docs 上に明記する
- `02-boundary-and-ids`
  - 外部検査機関 API の unknown payload を Zod の `safeParse` で検査する
  - `PetId` / `OwnerId` / `AppointmentId` を Zod brand で分離し、取り違えを型エラーにする
  - Result 型の設計や合成は次 module に送る
- `03-result-errors`
  - repository lookup、状態 guard、外部 payload parse を Result で合成する
  - controller ではなく use case の戻り値で失敗の種類を読む
- `04-agent-review`
  - コード変更はミニ総合演習1つに絞る
  - 「同じ変更を AI エージェントに依頼するなら、どの不変条件・境界・失敗型を指示するか」をテンプレート化する
  - ここで新しい原則を出さず、各 module の Agent Review を横断チェックリストにまとめる

各 exercise には `README.md` と `exercises/*.test.ts` を置く。通常テストは常に緑、exercise コマンドは module の開始時に赤、module 終了時に緑になる。解答差分は `solutions/module-NN.patch` または `solutions/module-NN/` に置き、講師が詰まった参加者へ案内できるようにする。

## ドキュメントサイト設計

docs site は「動物病院の院内ポータル」のような雰囲気にする。かわいさは背景装飾だけでなく、教材の理解を助ける UI として使う。

画面構成:

- 左サイドバー: module 一覧、所要時間、進捗の目安
- メイン: 章本文、コードブロック、テスト実行コマンド
- 右側または本文上部: 今日のカルテ、発生した事故、守りたい不変条件、次に実行するコマンド、現在の `Incident / Red / Edit / Green / Agent Review` フェーズ
- 下部: 次の module へのナビゲーション

ビジュアル方針:

- 犬、猫、うさぎ、鳥、ハムスターなどの小さな動物アイコンを module marker として使う。ただし装飾だけにせず、状態図、事故カード、検査結果票、会計済みスタンプなど教材理解に紐づける
- カードの角丸は 8px 以下。教材本文をカードだらけにせず、セクションは全幅の静かな bands で区切る
- 色は白、淡いミント、やわらかい黄、診察券の青緑、アクセントの赤を組み合わせる。単一のベージュ/クリーム支配にしない
- コードブロックは読みやすさ優先。かわいい装飾で可読性を落とさない
- モバイルではサイドバーを drawer にし、本文幅を優先する

実装方針:

- React などの UI フレームワークは使わず、Vite + TypeScript + DOM API で十分にする
- content は `apps/docs/src/content/modules.ts` に構造化データとして定義する
- Markdown parser は導入しない。本文は小さな typed content components として定義し、コードブロックは文字列で持つ
- 検索、読了 localStorage、オンライン judge は初版スコープ外

## Cloudflare Workers 設計

Wrangler は Workers Static Assets を使う。

- `wrangler.jsonc`
  - `main`: `worker/index.ts`
  - `assets.directory`: `apps/docs/dist`
  - `assets.binding`: `ASSETS`
  - `assets.not_found_handling`: `single-page-application`
  - `compatibility_date`: `2026-08-04`
- `worker/index.ts`
  - `/healthz` は `ok` を返す
  - それ以外は `env.ASSETS.fetch(request)` に委譲する

Cloudflare docs によると、Workers Static Assets は `assets.directory` を指定して deploy 時に Worker code と static assets をまとめて配信できる。SPA では `not_found_handling = "single-page-application"` が使える。Worker script を先に走らせたい route は `run_worker_first` で制御できるが、初版では `/healthz` 以外の API が不要なため、必要になるまで最小設定にする。

## テストと検証

必須コマンド:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm preview` または `pnpm dev` でローカル表示確認
- `pnpm --filter @fp-with-ts/clinic-example exercise:00` で module 開始時に赤くなる事故テストを確認

example の検証:

- 不正状態遷移が `@ts-expect-error` で固定されている
- unknown payload を `as` で通さず Zod parse している
- ID 取り違えが型エラーになる
- Result の error `kind` が use case ごとに網羅されている
- 各 module に「ここまでできたらOK」が1つずつ定義されている

docs site の検証:

- desktop 1440px と mobile 390px で、本文、サイドバー、コードブロックが重ならない
- 全 module のリンクが動く
- コードブロック内の長い行が横スクロールでき、本文幅を壊さない
- 画像または animal icon が読み込めない場合でも本文が読める

## 完了条件

- README にイベント当日の導線がある
- 参加者が clone 後、5分以内に `pnpm install`、`pnpm test`、`pnpm dev` まで到達できる
- docs site の top にイベントのタイムテーブルと module 対応がある
- 各 module に `Incident -> Red -> Edit -> Green -> Agent Review` と「ここまでできたらOK」がある
- example は DB や外部 API key を要求しない
- `pnpm typecheck`、`pnpm test`、`pnpm build` が通る
- Cloudflare Workers で `apps/docs/dist` が配信できる

## スコープ外

- 本番 DB、D1、KV、R2 などの永続化
- 認証、参加者別進捗保存、オンライン採点
- kosui.me への統合
- 長編教材の全章移植
- Sensitive 型とログ redact の本格ハンズオン
- Git tag で章ごとの開始/終了状態を固定する書籍型運用
