# Final: 動物病院の完成アプリ

`examples/final` は、予約を不正な状態へ戻す、用途の異なる ID を取り違える、現在状態だけ更新されて監査記録が残らない、機微情報が不要な画面やログへ混じるといった業務事故を防ぐ完成アプリです。Hono、Inertia、React、Drizzle、file SQLite を一つの package で動かします。

## セットアップと実行

Node.js 20 以上と pnpm を使います。手元では Node v25.4.0 で検証しており、Node.js 20 ではローカル実行していません（サポート対象は Node.js 20 以上です）。リポジトリルートで依存関係を入れ、アプリを起動します。

```bash
pnpm install
pnpm --filter @fp-with-ts/clinic-final dev
```

起動時に Drizzle migration が適用され、既定で `examples/final/clinic.sqlite` を使います。migration だけを適用する場合は、リポジトリルートで次を実行します。schema 変更時の SQL 生成には `db:generate` を使います。

```bash
pnpm --filter @fp-with-ts/clinic-final db:migrate
pnpm --filter @fp-with-ts/clinic-final db:generate
```

初回アクセスは `/setup` へ進み、最初の `Admin` を登録します。以後は `/login` からログインします。初期登録は installation marker、Admin、session、対応する2件の監査行を1つの transaction で確定します。

production build は次で作成します。このコマンドは、常に port 3000 で Node server を起動する `dist/index.js`、ソケットを開かずに明示した SQLite へ接続できる app factory の `dist/app.js`、`dist/static/client.js`、`dist/static/styles.css` を作ります。server entry は Vite の production mode を `isProduction: true` として構成するため、`NODE_ENV` を指定せず `node dist/index.js` を実行しても production asset と Secure cookie を使います。`dist/app.js` の factory を直接使う場合は `isProduction` を必ず指定します。built smoke は `:memory:` SQLite、migration directory、`isProduction: true` を渡し、production shell と Secure session cookie を `app.request` で確認します。

```bash
pnpm --filter @fp-with-ts/clinic-final build
pnpm --filter @fp-with-ts/clinic-final exec node dist/index.js
```

## ロールと業務フロー

- `Admin`: 初期設定、ユーザー管理、監査履歴の確認を担当します。
- `Receptionist`: 飼い主・ペット管理、予約、受付、会計、キャンセルを担当します。
- `Veterinarian`: 診察開始、検査結果登録、電話フォロー依頼を担当します。

予約業務は、日・週表示の `/appointments` **予約カレンダー**と、来院後の進行を縦に追う `/reception` **受付ボード**に分けています。一般診療、再診、予防接種、検査・処置は固定診療メニューと時間を持ちます。担当獣医師未定の予約は許可し、担当を決めた `Scheduled` / `CheckedIn` だけ、同じ担当獣医師の重複を拒否します。時間帯は半開区間 `[start, end)` なので、一方の終了時刻と次の開始時刻が同じ予約は重複しません。

来院状態は `Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid` と進みます。これとは別軸に settlement state の `NoPayment` / `DepositReceived` / `Settled` / `DepositRefunded` を持ちます。予防接種の `Scheduled` / `CheckedIn` だけ一度の前受金を記録でき、診察後の最終金額に応じて追加支払い、返金、差額なしをサーバーが差額精算します。前受済みのキャンセルは全額返金とキャンセルを同じ transaction で確定します。電話フォローは、会計済み予約、要フォローの検査結果、一致する pet ID を検証して対象を作ります。

## コードの責務

- `src/domain`: 判別共用体の状態、branded ID、`Sensitive`、純粋な遷移、typed domain event
- `src/useCase`: one-method resolver/read port と event store を `ResultAsync` で合成する業務処理
- `src/adaptor/primary`: Hono route、認証 cookie、Inertia props、React page
- `src/adaptor/secondary`: Drizzle/SQLite resolver、query reader、event store、パスワードハッシュ
- `src/app.ts`: SQLite を明示的に受け取る factory、依存関係、middleware、route を一つの Hono app へ構成
- `src/server.ts`: 既定の `clinic.sqlite`、migration directory、Vite の production flag を選び、server entry の app を構成

command use case は `AppointmentByIdResolver.resolveById` のような用途ごとの1メソッド port から現在状態を読み、ドメインが作った typed event を `AppointmentEventStore.store` へ渡します。すべての mutation は画面が読んだ `expectedVersion` を渡し、projection の version による条件付き更新で古い操作を `StaleAppointmentVersion` として拒否します。これは同じ予約の更新競合を検出する責務です。一方 SQLite の `BEGIN IMMEDIATE` は、担当獣医師の重複検査から projection・監査 event の保存までの writer transaction を直列化し、異なる予約間のスケジュール競合を防ぐ責務です。

監査は3テーブルに分けます。`domain_events` は event ID、aggregate、event name、実行者、発生時刻、分類の metadata、`domain_event_payloads` は Regular 分類の state/payload、`domain_event_sensitive_payloads` は Sensitive 分類の state/payload を保存します。来院理由、受付メモ、PII、診療情報、settlement 内訳を含む業務 event の aggregate state と event payload は機微テーブルへ完全に保存します。event は必ずどちらか一方の payload table に対応し、trigger が二重保存・更新・削除を拒否します。

`EventHistoryReader.list(admin: Admin)` は通常一覧へ metadata と Regular payload だけを返します。Sensitive payload は Admin が画面で明示的に開示したときだけ返し、同じ `BEGIN IMMEDIATE` transaction で `audit.sensitive-payload-viewed` を Regular 監査 event として追加します。機微情報の閲覧自体を監査し、閲覧記録が保存できない場合は値も開示しません。この分離はアプリ内の閲覧境界であり、**SQLite ファイル自体の at-rest encryption は対象外**です。ディスク暗号化とファイルアクセス制御は別途必要です。

診察結果の記録では `ExaminationCompletionStore` が `ExamResultRecorded` と `AppointmentExaminationCompleted` を受け取り、診察結果 projection、`AwaitingPayment` の予約 projection、2件の監査 event を1つの transaction で保存します。同じ `InExamination` を読んだ並行操作は条件付き更新で競合し、片方だけが確定します。

現在状態は各 event store が同じ transaction で更新する projection から読みます。監査履歴から現在状態を復元せず、監査行の再生や圧縮も行いません。

ユーザー、飼い主、ペットの削除は projection の物理削除です。削除 event と過去の監査行は保持されるため、この操作は個人情報の完全消去を意味しません。この制約は、利用目的と保持期間を別途レビューする必要があることを示します。

## 検証

package 単位のコマンドは次です。

```bash
pnpm --filter @fp-with-ts/clinic-final typecheck
pnpm --filter @fp-with-ts/clinic-final test
pnpm --filter @fp-with-ts/clinic-final build
```

リポジトリ全体の通常テスト、型検査、build はルートで次を実行します。意図的に失敗する演習はこれらの通常コマンドと分離されています。

```bash
pnpm test
pnpm typecheck
pnpm build
```

テストは temp file SQLite への migration、初期管理者、ログイン、3ロールの認可、予約カレンダーと受付ボード、重複制御、前受金から差額精算・返金までの業務フロー、projection と監査行の atomicity、PII・自由記述の機微テーブルへの保存、Admin の明示開示と閲覧 event を確認します。
