# Final: 動物病院の完成アプリ

`examples/final` は、予約を不正な状態へ戻す、用途の異なる ID を取り違える、現在状態だけ更新されて監査記録が残らない、PII が表示やログへ混じるといった業務事故を防ぐ完成アプリです。Hono、Inertia、React、Drizzle、file SQLite を一つの package で動かします。

## セットアップと実行

Node.js 20 以上と pnpm を使います。手元では Node v25.4.0 で検証しており、Node.js 20 ではローカル実行していません（サポート対象は Node.js 20 以上です）。リポジトリルートで依存関係を入れ、アプリを起動します。

```bash
pnpm install --frozen-lockfile
pnpm --filter @fp-with-ts/clinic-final dev
```

起動時に Drizzle migration が適用され、既定で `examples/final/clinic.sqlite` を使います。既存のmigrationだけを適用する場合は、リポジトリルートで次を実行します。

```bash
pnpm --filter @fp-with-ts/clinic-final db:migrate
```

schemaを変更した場合はSQLを生成し、内容を確認してからmigrationを適用します。

```bash
pnpm --filter @fp-with-ts/clinic-final db:generate
pnpm --filter @fp-with-ts/clinic-final db:migrate
```

初回アクセスは `/setup` へ進み、最初の `Admin` を登録します。以後は `/login` からログインします。初期登録は installation marker、Admin、session、対応する2件の監査行を1つの transaction で確定します。

production build は、常に port 3000 で Node server を起動する `dist/index.js`、`dist/static/client.js`、`dist/static/styles.css` を作ります。server entry は Vite の production mode を `isProduction: true` として構成するため、`NODE_ENV` を指定せず `node dist/index.js` を実行しても production asset と Secure cookie を使います。

```bash
pnpm --filter @fp-with-ts/clinic-final build
pnpm --filter @fp-with-ts/clinic-final exec node dist/index.js
```

## ロールと業務フロー

- `Admin`: 初期設定、ユーザー管理、監査履歴の確認を担当します。
- `Receptionist`: 飼い主・ペット管理、予約、受付、会計、キャンセルを担当します。
- `Veterinarian`: 診察開始、検査結果登録、電話フォロー依頼を担当します。

予約は `Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid` と進みます。診察結果を記録すると `AwaitingPayment` へ遷移し、診察結果の再送信を止めて、受付・管理者にだけ会計操作を表示します。電話フォローは、会計済み予約、要フォローの検査結果、一致する pet ID を検証して対象を作ります。

## コードの責務

- `src/domain`: 判別共用体の状態、branded ID、`Sensitive`、純粋な遷移、typed domain event
- `src/useCase`: one-method resolver/read port と event store を `ResultAsync` で合成する業務処理
- `src/adaptor/primary`: Hono route、認証 cookie、Inertia props、React page
- `src/adaptor/secondary`: Drizzle/SQLite resolver、query reader、event store、パスワードハッシュ
- `src/app.ts`: SQLite を明示的に受け取る factory、依存関係、middleware、route を一つの Hono app へ構成
- `src/server.ts`: 既定の `clinic.sqlite`、migration directory、Vite の production flag を選び、server entry の app を構成

command use case は `AppointmentByIdResolver.resolveById` のような用途ごとの1メソッド port から現在状態を読み、ドメインが作った typed event を `ExaminationStartedStore.store` のような event store へ渡します。event store は event から projection の insert/update/delete と監査行の insert を組み立て、Drizzle transaction で両方を atomic に保存します。監査用の1メソッド port は `EventHistoryReader.list(admin: Admin): ResultAsync<readonly SanitizedAuditRecord[], never>` です。Admin capability を受け取る reader 境界で保存行を Zod 検証し、許可した項目だけを `SanitizedAuditRecord` へ写して Admin の一覧画面へ届けます。利用者が判断できる明示的な業務競合だけを `Err` にし、`follow_up_request_claims.appointment_id` の競合は `FollowUpRequestConflict` として返します。それ以外の未知の SQLite 制約違反、保存済みデータの破損、SQLite 障害は rejection として Hono の共通エラー境界へ伝播し、opaque な 500 応答になります。

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

テストは temp file SQLite への migration、初期管理者、ログイン、3ロールの認可、予約から会計・フォロー・監査までの業務フロー、projection と監査行の atomicity、PII の非表示を確認します。
