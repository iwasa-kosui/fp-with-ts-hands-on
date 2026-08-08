# `examples/final` Hono + Inertia アプリケーション設計

## 目的

`examples/final` を、関数型ドメインモデリングのコード断片ではなく、業務操作を画面から実行できる動物病院アプリケーションへ作り直します。Hono、Inertia、React、Drizzle、SQLite を組み合わせ、既存教材で扱う状態、不変条件、境界、失敗、イベントを実アプリケーションの責務へ接続します。

完成後も、教材の判断基準を維持します。技法を増やすこと自体を目的にせず、予約の不正な状態遷移、入力値や ID の取り違え、保存の片落ち、PII の漏えいを防げる構成にします。

## スコープ

次の業務を画面と SQLite 永続化へ接続します。

- 最初の管理者登録、ログイン、ログアウト
- ユーザーの登録、編集、パスワード再設定、削除
- 飼い主の登録、編集、削除
- ペットの登録、編集、削除
- 予約登録、受付、診察開始、診察結果登録、会計、キャンセル
- 電話フォロー対象の抽出と `FollowUpRequested` の記録
- 管理者向けイベント履歴

外部メール送信、外部認証、イベント再生による projection の再構築、デプロイ構成は対象外です。物理削除後も過去イベントを保持するため、削除を個人情報の完全消去としては扱いません。

各 event store は最新の projection とイベント履歴を同じ transaction で永続化します。イベント履歴は監査用の read port から直接参照するだけで、aggregate の replay・rehydration やイベントの compaction には使用しません。

## 実行環境と採用ライブラリ

- Node.js 20
- Hono と `@hono/node-server`
- `@hono/inertia` と `@inertiajs/react`
- React と Vite
- Drizzle ORM、Drizzle Kit、`better-sqlite3`
- Zod
- neverthrow
- Vitest

Hono は Node.js adapter で起動します。`@hono/inertia` の middleware が初回アクセスでは HTML shell を返し、Inertia の遷移では page object を返します。React Router や別の REST API は追加しません。

## ディレクトリ構成

主要なサーバーコードを次の責務で分けます。

```text
examples/final/
├── drizzle/
├── src/
│   ├── domain/
│   │   ├── aggregate/
│   │   ├── appointment/
│   │   ├── examResult/
│   │   ├── owner/
│   │   ├── pet/
│   │   ├── session/
│   │   ├── user/
│   │   └── followUp/
│   ├── adaptor/
│   │   ├── primary/
│   │   │   └── web/
│   │   │       ├── middleware/
│   │   │       ├── pages/
│   │   │       └── routes/
│   │   └── secondary/
│   │       ├── authentication/
│   │       └── sqlite/
│   │           ├── resolver/
│   │           ├── store/
│   │           ├── db.ts
│   │           └── schema.ts
│   ├── useCase/
│   └── app.ts
├── test/
├── drizzle.config.ts
└── vite.config.ts
```

`domain` は業務状態、値、純粋な遷移、イベントを定義します。`adaptor/primary` は HTTP、cookie、Inertia props、React ページを扱います。`adaptor/secondary` は SQLite、パスワードハッシュ、セッショントークン生成を扱います。`useCase` は resolver と event store を組み合わせます。`app.ts` は依存関係を組み立てて Hono app を返します。

## ドメインモデル

### Aggregate とイベント

各 aggregate は ID、名前、状態を持ちます。各操作は状態そのものではなく、操作後の状態と変更内容を持つイベントを返します。

```typescript
type DomainEvent<
  TAggregateId,
  TAggregateName extends string,
  TAggregateState,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<{
  kind: TKind;
  eventId: EventId;
  aggregateId: TAggregateId;
  aggregateName: TAggregateName;
  aggregateState: TAggregateState | undefined;
  eventName: TEventName;
  eventPayload: TEventPayload;
  occurredAt: Timestamp;
  actorUserId: UserId;
}>;
```

`kind` は TypeScript の判別に使います。`eventName` はイベント履歴に保存する安定した名前です。作成・更新イベントの `aggregateState` は操作後の状態を持ちます。削除イベントでは `aggregateState` を `undefined` にします。

イベントごとに `AggregateStore<TEvent>` を使った store contract を定義します。use case は event store へ状態を渡さず、ドメインが生成したイベントだけを渡します。

```typescript
type AggregateStore<TEvent extends AnyDomainEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, RepositoryError>;
}>;
```

### 予約

`Appointment` は次の判別共用体を維持します。

```text
Scheduled → CheckedIn → InExamination → Paid
    └──────────┴──────────────→ Canceled
```

- `Scheduled` は予約時刻、受診理由、飼い主 ID、ペット ID を必須にします。
- `CheckedIn` は受付時刻を必須にします。
- `InExamination` は獣医師 ID と診察開始時刻を必須にします。
- `Paid` は診断、処置、支払額、支払時刻を必須にします。
- `Canceled` はキャンセル理由、キャンセル時刻、必要な場合だけ再診希望時刻を持ちます。

遷移関数は有効な遷移元の型だけを受け取る純粋関数にします。予期可能な失敗は use case が `ResultAsync` の error として返します。成功した遷移だけがイベントを生成します。

### 飼い主、ペット、検査結果

`Owner` は氏名、メールアドレス、電話番号を持ち、PII を `Sensitive` で包みます。`Pet` は飼い主 ID、名前、種別を持ちます。`ExamResult` は検査 ID、ペット ID、採取時刻、検査項目、電話フォロー要否を持ちます。

電話フォロー対象は、会計済み予約、要フォローの検査結果、同じペット ID という条件から導出します。候補全体を検証し、一件でも不整合があれば部分結果を返しません。操作が成功した場合だけ `FollowUpRequested` を保存します。

### ユーザー、ロール、セッション

`User` は `Admin`、`Receptionist`、`Veterinarian` のいずれかのロールを持ちます。メールアドレスと表示名は `Sensitive` で包みます。パスワードハッシュは primary adaptor や Inertia props へ渡しません。

`Session` はユーザー ID、セッショントークンのハッシュ、有効期限を持ちます。ブラウザへはランダムなトークンを cookie として返し、SQLite にはハッシュだけを保存します。

## 削除契約

- ユーザーは、自分自身と最後の管理者を除き物理削除できます。削除時に関連セッションも同じトランザクションで削除します。
- ペットは進行中の予約がない場合に物理削除できます。`Paid` と `Canceled` の予約は履歴として残します。
- 飼い主は所属ペットを削除した後に物理削除できます。
- 過去の予約は削除済み ID を保持し、画面では関連する現在状態が見つからない場合に「削除済み」と表示します。
- 削除操作は対象 ID、実行者 ID、実行日時を event payload に記録します。パスワードハッシュは記録しません。

過去イベントには作成・更新時点の aggregate state が残ります。イベント履歴画面とログ出力では、飼い主やユーザーの PII を表示しません。

## SQLite projection とイベント保存

現在状態用に `users`、`sessions`、`owners`、`pets`、`appointments`、`exam_results` を持ちます。`domain_events` は次の項目を持ちます。

- event ID
- aggregate ID
- aggregate 名
- aggregate state の JSON
- event 名
- event payload の JSON
- 発生日時
- 実行ユーザー ID

secondary adaptor の event store は Drizzle の1トランザクション内で、イベントに応じて現在状態テーブルを insert、update、delete し、同じイベントを `domain_events` へ insert します。どちらかが失敗した場合は両方を rollback し、`RepositoryError` を返します。

SQLite の行は外部入力として扱い、resolver が Zod schema で検証してからドメイン型へ変換します。PII を保存するときだけ secondary adaptor が `Sensitive.unwrap()` を明示的に呼びます。DB 行やイベントをログへ出しません。

## Use case contract

各コマンド use case は一ファイルにし、依存関係を `run` の外側から注入します。`StartExaminationUseCase` は次の形にします。

```typescript
type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

type UseCaseOk = Readonly<{
  appointment: InExamination;
}>;

type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | RepositoryError;

type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;

type Dependencies = Readonly<{
  userResolver: UserResolver;
  appointmentResolver: AppointmentResolver;
  examinationStartedStore: ExaminationStartedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;

export type StartExaminationUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const run =
  ({
    userResolver,
    appointmentResolver,
    examinationStartedStore,
    clock,
    eventIdGenerator,
  }: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput => {
    // ResultAsync pipeline
  };
```

companion object の `create(dependencies)` が `{ run: run(dependencies) }` を返します。日時と event ID は注入し、テストで固定できるようにします。

主な command use case は次です。

- `setUpInitialAdminUseCase.ts`
- `logInUseCase.ts`
- `logOutUseCase.ts`
- `createUserUseCase.ts`
- `updateUserUseCase.ts`
- `resetUserPasswordUseCase.ts`
- `deleteUserUseCase.ts`
- `createOwnerUseCase.ts`
- `updateOwnerUseCase.ts`
- `deleteOwnerUseCase.ts`
- `createPetUseCase.ts`
- `updatePetUseCase.ts`
- `deletePetUseCase.ts`
- `bookAppointmentUseCase.ts`
- `checkInAppointmentUseCase.ts`
- `startExaminationUseCase.ts`
- `recordExamResultUseCase.ts`
- `recordPaymentUseCase.ts`
- `cancelAppointmentUseCase.ts`
- `requestFollowUpUseCase.ts`

一覧と詳細の取得も query use case を経由し、primary adaptor から Drizzle を直接呼びません。

## 認証と認可

最初の管理者は、ユーザーが0件の場合だけ `/setup` から登録できます。パスワードは Node.js の `scrypt` でハッシュ化します。ログイン成功時にセッションを発行し、8時間後に失効させます。

cookie には `HttpOnly` と `SameSite=Lax` を設定します。本番相当の起動では `Secure` も設定します。Hono の CSRF middleware と secure headers middleware を適用します。

権限は primary adaptor の表示制御だけに依存しません。command use case が実行ユーザーを解決し、次の契約を検証します。

- `Admin` は全操作、ユーザー管理、イベント履歴を利用できます。
- `Receptionist` は飼い主、ペット、予約、受付、キャンセル、会計、電話フォローを扱えます。
- `Veterinarian` は診察開始と検査結果登録を扱えます。
- 全ロールはダッシュボードと許可された業務データを閲覧できます。

## Primary adaptor と画面

外部入力は primary adaptor の Zod schema で検証し、検証済みの値だけを use case へ渡します。use case error は `kind` を網羅的に処理して HTTP または Inertia response に変換します。

- `ValidationError`: Inertia のフォームエラー
- `UnauthenticatedError`: ログイン画面へ redirect
- `UnauthorizedError`: 403
- not found 系 error: 404
- 状態競合や削除条件違反: 409
- `RepositoryError`: 500

画面と route は次の単位にします。

- `/setup`、`/login`
- `/`: 件数と進行中予約を表示するダッシュボード
- `/appointments`: 一覧、登録、詳細、状態別操作
- `/owners`: 一覧、登録、編集、削除
- `/pets`: 一覧、登録、編集、削除
- `/follow-ups`: 対象一覧、依頼済みイベントの記録
- `/users`: 管理者向け登録、編集、パスワード再設定、削除
- `/events`: 管理者向けイベント履歴

予約詳細では現在の `kind` と権限に応じて実行可能な操作だけを表示します。表示制御は使いやすさのために行い、認可判断は use case でも必ず実施します。

## テスト

### ドメインテスト

- 不正な予約状態遷移が型エラーになること
- 状態固有の情報が必須になること
- ドメイン操作が正しい aggregate state と payload を持つイベントを返すこと
- ID の取り違えをコンパイル時に防ぐこと
- `Sensitive` が JSON、文字列、Node.js inspect で値を隠すこと
- 電話フォロー候補を全件検証してから結果を返すこと

### Use case テスト

- 成功時だけ event store が一度呼ばれること
- 未認証、権限不足、対象なし、状態競合を判別可能な error として返すこと
- resolver または store の失敗後に後続処理を実行しないこと
- `StartExaminationUseCase` が `ResultAsync` を返し、`ExaminationStarted` だけを store へ渡すこと
- 自分自身と最後の管理者を削除できないこと
- 進行中予約があるペットを削除できないこと

### SQLite adaptor テスト

- event store が projection 更新とイベント追記を同じトランザクションで行うこと
- 保存途中の失敗で両方を rollback すること
- 削除イベントで現在状態を物理削除し、イベント履歴を残すこと
- resolver が不正な DB 行を `RepositoryError` として扱うこと

### Hono と Inertia のテスト

- 初期管理者登録がユーザー0件の場合だけ使えること
- ログイン、ログアウト、セッション失効が動くこと
- 各ロールの許可と拒否が route と use case の両方で機能すること
- フォーム入力エラーが Inertia response に変換されること
- 予約登録から会計までの通常フローを実行できること
- PII とパスワードハッシュが Inertia props やイベント履歴画面へ出ないこと

完了前に package 単体の test と typecheck に加え、リポジトリ全体の `pnpm typecheck`、`pnpm test`、`pnpm build` を実行します。
