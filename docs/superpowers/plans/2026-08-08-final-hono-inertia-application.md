# `examples/final` Hono + Inertia Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `examples/final` を、認証・ユーザー管理・動物病院の全業務を操作でき、ドメインイベントから SQLite projection とイベント履歴を同一トランザクションで更新する Hono + Inertia + React アプリケーションへ作り直します。

**Architecture:** ドメイン操作は `aggregateState` と `eventPayload` を持つ型付きイベントを返します。use case は resolver とイベントを受け取る store だけへ依存し、primary adaptor が Hono/Inertia、secondary adaptor が Drizzle/SQLite と認証プリミティブを実装します。`src/app.ts` は依存関係を組み立て、テストではインメモリ SQLite と固定 clock/generator を注入します。

**Tech Stack:** Node.js 20、TypeScript 5.9、Hono 4、`@hono/inertia` 0.7、Inertia React 3、React 19、Vite、Drizzle ORM、`better-sqlite3`、Zod 3、neverthrow 8、Vitest 2

## Global Constraints

- サーバーの実行環境は Node.js 20 とし、SQLite はファイルまたはテスト用 `:memory:` で動かします。
- サーバーコードは `domain`、`adaptor/primary`、`adaptor/secondary`、`useCase`、`app.ts` に分けます。
- ドメイン型は `type`、`Readonly<>`、`kind` 判別、companion object、一概念一ファイルを使います。
- 外部 HTTP 入力と SQLite 行は Zod で検証し、用途の異なる ID は Zod brand で区別します。
- 予期可能な失敗と DB 失敗は neverthrow の `Result` / `ResultAsync` で返し、domain と use case では `throw` しません。
- command use case は `Dependencies` を受け取る `run` と `ResultAsync` 出力に統一します。
- store は状態ではなくイベントを受け取り、projection 更新とイベント追記を1つの Drizzle transaction で行います。
- 物理削除後もイベントを保持します。イベント画面、Inertia props、ログへ PII、パスワードハッシュ、セッショントークンハッシュを出しません。
- 相対 import には `.js` suffix を付けます。
- TypeScript または教材ロジックの変更後は package test、`pnpm typecheck`、`pnpm test` を実行し、完了前に `pnpm build` も実行します。

---

## File Map

### Domain

- `examples/final/src/domain/aggregate/domainEvent.ts`: aggregate と domain event の共通型
- `examples/final/src/domain/aggregate/aggregateStore.ts`: イベントを受け取る store contract
- `examples/final/src/domain/aggregate/eventContext.ts`: event ID、日時、実行者を遷移へ渡す値
- `examples/final/src/domain/aggregate/eventId.ts`: branded event ID
- `examples/final/src/domain/aggregate/timestamp.ts`: branded ISO timestamp
- `examples/final/src/domain/aggregate/repositoryError.ts`: resolver/store 共通の infrastructure error
- `examples/final/src/domain/shared/schemaResult.ts`: Standard Schema から neverthrow `Result` への変換
- `examples/final/src/domain/shared/sensitive.ts`: PII と secret の redaction wrapper
- `examples/final/src/domain/appointment/*`: 予約状態、ID、イベント、resolver/store contract
- `examples/final/src/domain/user/*`: ユーザー状態、ロール、権限、イベント、resolver/store contract
- `examples/final/src/domain/session/*`: セッション状態、token hash、イベント、resolver/store contract
- `examples/final/src/domain/owner/*`: 飼い主状態、PII、イベント、resolver/store contract
- `examples/final/src/domain/pet/*`: ペット状態、イベント、resolver/store contract
- `examples/final/src/domain/examResult/*`: 検査結果、イベント、resolver/store contract
- `examples/final/src/domain/followUp/*`: 電話フォロー候補、対象、イベント、resolver/store contract

### Use cases

- `examples/final/src/useCase/*UseCase.ts`: command/query ごとの `Dependencies`、`UseCaseInput`、`UseCaseOutput`、`run`
- `examples/final/src/useCase/errors.ts`: 複数 use case が共有する not found、unauthorized、conflict error
- `examples/final/src/useCase/authorization.ts`: actor 解決と role 検証の ResultAsync helper

### Secondary adaptors

- `examples/final/src/adaptor/secondary/sqlite/schema.ts`: Drizzle table 定義
- `examples/final/src/adaptor/secondary/sqlite/db.ts`: file / memory SQLite の接続と migration
- `examples/final/src/adaptor/secondary/sqlite/eventRecord.ts`: secret を永続イベント表現から除外する mapper
- `examples/final/src/adaptor/secondary/sqlite/resolver/*.ts`: Zod 検証を伴う query 実装
- `examples/final/src/adaptor/secondary/sqlite/store/*.ts`: aggregate ごとの event store 実装
- `examples/final/src/adaptor/secondary/authentication/scryptPasswordHasher.ts`: scrypt hash / verify
- `examples/final/src/adaptor/secondary/authentication/sessionToken.ts`: token 発行と SHA-256 hash
- `examples/final/drizzle/0000_initial.sql`: 初期 schema

### Primary adaptors

- `examples/final/src/adaptor/primary/web/rootView.tsx`: Inertia HTML shell
- `examples/final/src/adaptor/primary/web/client.tsx`: React bootstrap
- `examples/final/src/adaptor/primary/web/styles.css`: 共通 UI
- `examples/final/src/adaptor/primary/web/middleware/*.ts`: session、shared props、error 変換
- `examples/final/src/adaptor/primary/web/routes/*.ts`: setup/auth/dashboard/業務 route
- `examples/final/src/adaptor/primary/web/pages/**/*.tsx`: Inertia React pages
- `examples/final/src/app.ts`: production composition root と test 用 `createApp`

---

### Task 1: Toolchain and domain kernel

**Files:**
- Modify: `examples/final/package.json`
- Modify: `examples/final/tsconfig.json`
- Modify: `examples/final/vitest.config.ts`
- Create: `examples/final/vite.config.ts`
- Create: `examples/final/drizzle.config.ts`
- Create: `examples/final/.gitignore`
- Create: `examples/final/src/domain/aggregate/domainEvent.ts`
- Create: `examples/final/src/domain/aggregate/aggregateStore.ts`
- Create: `examples/final/src/domain/aggregate/eventContext.ts`
- Create: `examples/final/src/domain/aggregate/clock.ts`
- Create: `examples/final/src/domain/aggregate/eventIdGenerator.ts`
- Create: `examples/final/src/domain/aggregate/eventId.ts`
- Create: `examples/final/src/domain/aggregate/timestamp.ts`
- Create: `examples/final/src/domain/aggregate/repositoryError.ts`
- Create: `examples/final/src/domain/user/userId.ts`
- Create: `examples/final/src/domain/shared/schemaResult.ts`
- Create: `examples/final/src/domain/shared/sensitive.ts`
- Create: `examples/final/test/domain/aggregate.test.ts`

**Interfaces:**
- Produces: `DomainEvent`, `AnyDomainEvent`, `AggregateStore<TEvent>`, `EventContext`, `Clock`, `EventIdGenerator`, `EventId`, `Timestamp`, `UserId`, `RepositoryError`, `Sensitive<T>`, `schemaResult`

- [ ] **Step 1: Add dependencies and scripts**

Set `dev`, `build`, `db:generate`, `db:migrate`, `typecheck`, and `test` scripts. Add `@hono/inertia@^0.7.0`, `@hono/node-server@^2.1.0`, `@inertiajs/react@^3.6.1`, `hono@^4.12.8`, `react@^19.2.4`, `react-dom@^19.2.4`, `drizzle-orm@^0.45.2`, and `better-sqlite3@^11.9.1` as runtime dependencies. Add `@hono/vite-build@^1.11.1`, `@hono/vite-dev-server@^0.26.1`, `@vitejs/plugin-react@^4.3.4`, `@types/better-sqlite3@^7.6.13`, `@types/react@^19.2.14`, `@types/react-dom@^19.2.3`, `drizzle-kit@^0.31.10`, and `vite@^6.1.1` as dev dependencies. Keep neverthrow, Zod, Standard Schema, and Vitest.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build --mode client && vite build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write the failing aggregate contract test**

Test that a deletion event can carry `aggregateState: undefined`, that `AggregateStore.store()` receives the event, and that `Sensitive` redacts serialization. Define the test-only event type against `DomainEvent` so this task does not depend on the Owner aggregate from Task 5.

```typescript
type ExampleDeleted = DomainEvent<
  string,
  "Example",
  Readonly<{ id: string }>,
  "ExampleDeleted",
  "example.deleted",
  Readonly<{ id: string }>
>;

const deleted = {
  kind: "ExampleDeleted",
  eventId,
  aggregateId: "example-1",
  aggregateName: "Example",
  aggregateState: undefined,
  eventName: "example.deleted",
  eventPayload: { id: "example-1" },
  occurredAt,
  actorUserId,
} as const satisfies ExampleDeleted;

expect(JSON.stringify(Sensitive.of("owner@example.test"))).toBe('"[REDACTED]"');
expect(deleted.aggregateState).toBeUndefined();
```

- [ ] **Step 3: Run the test and confirm the red state**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/aggregate.test.ts`

Expected: FAIL because the new aggregate modules do not exist.

- [ ] **Step 4: Implement the domain kernel and Vite/Drizzle configs**

Use this store contract and keep event variants discriminated by `kind`.

```typescript
export type AggregateStore<TEvent extends AnyDomainEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, RepositoryError>;
}>;
```

Configure Vite with `@hono/inertia/vite`, `@hono/vite-dev-server/node`, `@hono/vite-build/node`, and `@vitejs/plugin-react`. Client mode writes `dist/static/client.js` and `dist/static/styles.css`; server mode builds `src/app.ts` to `dist/index.js`. Mark `better-sqlite3` as an external dependency in the Node build so Vite does not bundle its native binary. Add `jsx: "react-jsx"`, DOM libraries, and `src/**/*.tsx` to `tsconfig.json`. Ignore `clinic.sqlite`, `clinic.sqlite-shm`, and `clinic.sqlite-wal` in `examples/final/.gitignore`.

- [ ] **Step 5: Verify the kernel**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/aggregate.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml examples/final/.gitignore examples/final/package.json examples/final/tsconfig.json examples/final/vitest.config.ts examples/final/vite.config.ts examples/final/drizzle.config.ts examples/final/src/domain/aggregate examples/final/src/domain/shared examples/final/src/domain/user/userId.ts examples/final/test/domain/aggregate.test.ts
git commit -m "feat(final): イベント駆動アプリのドメイン基盤を追加"
```

### Task 2: Appointment aggregate emits typed events

**Files:**
- Create: `examples/final/src/domain/appointment/appointment.ts`
- Create: `examples/final/src/domain/appointment/appointmentId.ts`
- Create: `examples/final/src/domain/appointment/veterinarianId.ts`
- Create: `examples/final/src/domain/appointment/paymentAmount.ts`
- Create: `examples/final/src/domain/appointment/appointmentEvent.ts`
- Create: `examples/final/src/domain/appointment/appointmentResolver.ts`
- Create: `examples/final/src/domain/appointment/appointmentStores.ts`
- Create: `examples/final/test/domain/appointment.test.ts`

**Interfaces:**
- Consumes: `EventContext`, `AggregateStore<TEvent>`, `ResultAsync`, `RepositoryError`
- Produces: `Appointment`, `Scheduled`, `CheckedIn`, `InExamination`, `Paid`, `Canceled`, `AppointmentResolver`, event-specific store types

- [ ] **Step 1: Write failing tests for every valid transition**

Assert that `book`, `checkIn`, `startExamination`, `recordPayment`, and `cancel` return events whose `aggregateState` is the exact target state. Keep compile-time assertions proving `Paid` cannot start examination and raw numbers cannot be payment amounts.

```typescript
const event = Appointment.startExamination(context)(checkedIn, veterinarianId);

expect(event).toMatchObject({
  kind: "ExaminationStarted",
  eventName: "appointment.examination-started",
  aggregateState: {
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt: context.occurredAt,
  },
});
```

- [ ] **Step 2: Run the appointment tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/appointment.test.ts`

Expected: FAIL because the event-returning appointment aggregate does not exist.

- [ ] **Step 3: Implement the state union, pure event-producing transitions, and contracts**

Define `AppointmentEvent` as the union of `AppointmentBooked`, `AppointmentCheckedIn`, `ExaminationStarted`, `PaymentRecorded`, and `AppointmentCanceled`. Each event companion receives `EventContext`; no transition reads the clock or generates an ID internally.

```typescript
const startExamination =
  (context: EventContext) =>
  (checkedIn: CheckedIn, veterinarianId: VeterinarianId): ExaminationStarted => {
    const aggregateState = {
      ...checkedIn,
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: context.occurredAt,
    } as const satisfies InExamination;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "ExaminationStarted",
      "appointment.examination-started",
      { appointmentId: aggregateState.appointmentId, veterinarianId },
    );
  };
```

- [ ] **Step 4: Verify the appointment aggregate**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/appointment.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS, including the `@ts-expect-error` assertions.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/domain/appointment examples/final/test/domain/appointment.test.ts
git commit -m "feat(final): 予約遷移が型付きイベントを返すよう変更"
```

### Task 3: User, session, and authentication domain

**Files:**
- Create: `examples/final/src/domain/user/user.ts`
- Create: `examples/final/src/domain/user/userEmail.ts`
- Create: `examples/final/src/domain/user/userName.ts`
- Create: `examples/final/src/domain/user/passwordHash.ts`
- Create: `examples/final/src/domain/user/passwordHasher.ts`
- Create: `examples/final/src/domain/user/userEvent.ts`
- Create: `examples/final/src/domain/user/userResolver.ts`
- Create: `examples/final/src/domain/user/userStores.ts`
- Create: `examples/final/src/domain/user/permission.ts`
- Create: `examples/final/src/domain/session/session.ts`
- Create: `examples/final/src/domain/session/sessionId.ts`
- Create: `examples/final/src/domain/session/sessionTokenHash.ts`
- Create: `examples/final/src/domain/session/sessionTokenGenerator.ts`
- Create: `examples/final/src/domain/session/sessionEvent.ts`
- Create: `examples/final/src/domain/session/sessionResolver.ts`
- Create: `examples/final/src/domain/session/sessionStores.ts`
- Create: `examples/final/src/adaptor/secondary/authentication/scryptPasswordHasher.ts`
- Create: `examples/final/src/adaptor/secondary/authentication/sessionToken.ts`
- Create: `examples/final/test/domain/user.test.ts`
- Create: `examples/final/test/adaptor/authentication.test.ts`

**Interfaces:**
- Consumes: Task 1 aggregate kernel and Task 2 `VeterinarianId`
- Produces: role-discriminated `User`, `UserResolver`, typed user stores, `Session`, `SessionResolver`, typed session stores, `PasswordHasher`, `SessionTokenGenerator`

- [ ] **Step 1: Write failing role, redaction, password, and token tests**

Cover the three user variants, require `veterinarianId` only for `Veterinarian`, verify permission predicates, verify scrypt success/failure, and prove session token hash differs from the cookie token.

```typescript
expect(Permission.canStartExamination(veterinarian)).toBe(true);
expect(Permission.canManageUsers(receptionist)).toBe(false);
expect(await passwordHasher.verify(password, hash)).toBe(true);
expect(token.hash).not.toBe(token.plaintext.unwrap());
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/user.test.ts test/adaptor/authentication.test.ts`

Expected: FAIL because user/session/authentication modules do not exist.

- [ ] **Step 3: Implement the domain and secondary authentication primitives**

Model `Admin`, `Receptionist`, and `Veterinarian` as a `User` discriminated union. Expose permission predicates from `Permission`. Wrap email, display name, password hash, plaintext password, and token material in `Sensitive`. Implement scrypt with a random salt and constant-time verification. Implement a 32-byte random session token and store only its SHA-256 hash.

- [ ] **Step 4: Verify authentication primitives**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/user.test.ts test/adaptor/authentication.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/domain/user examples/final/src/domain/session examples/final/src/adaptor/secondary/authentication examples/final/test/domain/user.test.ts examples/final/test/adaptor/authentication.test.ts
git commit -m "feat(final): ロール付きユーザーとセッション認証を追加"
```

### Task 4: StartExaminationUseCase contract

**Files:**
- Create: `examples/final/src/useCase/errors.ts`
- Create: `examples/final/src/useCase/authorization.ts`
- Create: `examples/final/src/useCase/startExaminationUseCase.ts`
- Create: `examples/final/test/useCase/startExaminationUseCase.test.ts`

**Interfaces:**
- Consumes: `UserResolver`, `AppointmentResolver`, `ExaminationStartedStore`, `Clock`, `EventIdGenerator`
- Produces: `StartExaminationUseCase.create(dependencies)` and the exact `run(input): ResultAsync<UseCaseOk, UseCaseError>` contract

- [ ] **Step 1: Write failing use case tests**

Cover success, appointment not found, wrong state, unauthorized receptionist, veterinarian mismatch, resolver error, and store error. On success assert that the store receives one `ExaminationStarted` event rather than a state object.

```typescript
const result = await useCase.run(input);

expect(result.isOk()).toBe(true);
expect(storedEvents).toHaveLength(1);
expect(storedEvents[0]?.kind).toBe("ExaminationStarted");
expect(storedEvents[0]?.aggregateState.kind).toBe("InExamination");
```

- [ ] **Step 2: Run the use case test and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/startExaminationUseCase.test.ts`

Expected: FAIL because `StartExaminationUseCase` does not exist.

- [ ] **Step 3: Implement the requested Dependencies → run → ResultAsync form**

Use this complete pipeline. `ensureCanStartExamination` accepts Admin or Veterinarian and requires a Veterinarian actor to use their own `veterinarianId`.

```typescript
const run =
  ({
    userResolver,
    appointmentResolver,
    examinationStartedStore,
    clock,
    eventIdGenerator,
  }: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    userResolver
      .resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanStartExamination(input.veterinarianId))
      .andThen(() => appointmentResolver.resolveById(input.appointmentId))
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        Appointment.startExamination({
          eventId: eventIdGenerator.generate(),
          occurredAt: clock.now(),
          actorUserId: input.actorUserId,
        })(appointment, input.veterinarianId),
      )
      .andThrough((event) => examinationStartedStore.store(event))
      .map((event) => ({ appointment: event.aggregateState }));
```

- [ ] **Step 4: Verify the requested contract**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/startExaminationUseCase.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/useCase/errors.ts examples/final/src/useCase/authorization.ts examples/final/src/useCase/startExaminationUseCase.ts examples/final/test/useCase/startExaminationUseCase.test.ts
git commit -m "feat(final): 診察開始をResultAsync use caseへ変更"
```

### Task 5: Owner, pet, examination result, and follow-up domains

**Files:**
- Create: `examples/final/src/domain/owner/owner.ts`
- Create: `examples/final/src/domain/owner/ownerId.ts`
- Create: `examples/final/src/domain/owner/ownerName.ts`
- Create: `examples/final/src/domain/owner/ownerEmail.ts`
- Create: `examples/final/src/domain/owner/ownerPhone.ts`
- Create: `examples/final/src/domain/owner/ownerEvent.ts`
- Create: `examples/final/src/domain/owner/ownerResolver.ts`
- Create: `examples/final/src/domain/owner/ownerStores.ts`
- Create: `examples/final/src/domain/pet/pet.ts`
- Create: `examples/final/src/domain/pet/petId.ts`
- Create: `examples/final/src/domain/pet/petEvent.ts`
- Create: `examples/final/src/domain/pet/petResolver.ts`
- Create: `examples/final/src/domain/pet/petStores.ts`
- Create: `examples/final/src/domain/examResult/examResult.ts`
- Create: `examples/final/src/domain/examResult/examId.ts`
- Create: `examples/final/src/domain/examResult/examResultEvent.ts`
- Create: `examples/final/src/domain/examResult/examResultResolver.ts`
- Create: `examples/final/src/domain/examResult/examResultStores.ts`
- Create: `examples/final/src/domain/followUp/followUpCandidate.ts`
- Create: `examples/final/src/domain/followUp/followUpTarget.ts`
- Create: `examples/final/src/domain/followUp/followUpRequested.ts`
- Create: `examples/final/src/domain/followUp/collectFollowUpTargets.ts`
- Create: `examples/final/src/domain/followUp/followUpResolver.ts`
- Create: `examples/final/src/domain/followUp/followUpStores.ts`
- Create: `examples/final/test/domain/ownerPet.test.ts`
- Create: `examples/final/test/domain/followUp.test.ts`

**Interfaces:**
- Consumes: Task 1 aggregate kernel and Task 2 appointment identity/state
- Produces: event-returning create/update/delete functions for Owner/Pet/ExamResult, follow-up candidate validation and request event

- [ ] **Step 1: Write failing domain tests**

Verify PII wrapping at Owner schema parse, owner/pet create-update-delete event shapes, exam result pet identity, all-or-nothing candidate validation, paid + needs-follow-up filtering, and appointment ID deduplication.

```typescript
const parsed = Owner.parse(rawOwner);
expect(parsed.isOk()).toBe(true);
expect(JSON.stringify(parsed._unsafeUnwrap())).not.toContain("owner@example.test");

const targets = collectFollowUpTargets(validCandidates);
expect(targets.isOk() && targets.value).toHaveLength(1);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/ownerPet.test.ts test/domain/followUp.test.ts`

Expected: FAIL because the new aggregate modules do not exist.

- [ ] **Step 3: Implement the four domain areas**

Keep Owner PII wrapped through domain processing. Pet carries `ownerId`, name, and species. ExamResult carries `examId`, `petId`, `collectedAt`, non-empty items, and `needsFollowUp`. Follow-up validation returns `ExamResultPetMismatch` before producing any target.

- [ ] **Step 4: Verify the domain tests**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/domain/ownerPet.test.ts test/domain/followUp.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/domain/owner examples/final/src/domain/pet examples/final/src/domain/examResult examples/final/src/domain/followUp examples/final/test/domain/ownerPet.test.ts examples/final/test/domain/followUp.test.ts
git commit -m "feat(final): 患者管理と電話フォローのイベントモデルを追加"
```

### Task 6: Drizzle schema, migrations, resolvers, and event stores

**Files:**
- Create: `examples/final/src/adaptor/secondary/sqlite/schema.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/db.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/eventRecord.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/userResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/sessionResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/ownerResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/petResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/examResultResolver.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/resolver/followUpResolver.ts`
- Create: `examples/final/src/useCase/query/eventHistoryReader.ts`
- Create: `examples/final/src/useCase/query/followUpRequestReader.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/query/eventHistoryReader.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/query/followUpRequestReader.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/userEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/sessionEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/ownerEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/petEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/examResultEventStore.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/store/followUpEventStore.ts`
- Create: `examples/final/drizzle/0000_initial.sql`
- Create: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Create: `examples/final/test/adaptor/sqliteResolver.test.ts`

**Interfaces:**
- Consumes: every resolver/store contract from Tasks 2, 3, and 5
- Produces: `createSqliteDatabase(path)`, `migrateDatabase(db)`, concrete resolver, query reader, and event store factories

- [ ] **Step 1: Write failing SQLite integration tests**

Use a fresh `:memory:` database per test. Verify each event store applies its projection and appends one event. Add a failure fixture that violates the `domain_events.event_id` unique constraint and prove the projection update rolls back. Verify deletion events remove the projection and retain a deletion event. Insert one malformed row with raw SQL and expect `RepositoryError` from its resolver.

- [ ] **Step 2: Run SQLite tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts`

Expected: FAIL because schema, migration, resolvers, and stores do not exist.

- [ ] **Step 3: Implement schema and migration**

Create `users`, `sessions`, `owners`, `pets`, `appointments`, `exam_results`, and `domain_events`. Use text UUIDs, ISO timestamps, JSON text columns for state/payload, and unique user emails/session token hashes. Use foreign keys only within live ownership/session relationships; historical appointment IDs remain stable after related aggregate deletion.

- [ ] **Step 4: Implement resolver row parsing**

Each resolver wraps Drizzle work with `ResultAsync.fromPromise`. Parse returned rows with a Zod schema and map thrown DB or schema failures to `{ kind: "RepositoryError", operation, cause }`.

- [ ] **Step 5: Implement event stores**

Each `store(...events)` opens one Drizzle transaction. For every event, switch exhaustively on `kind`, apply insert/update/delete from `aggregateState`, then append a safe event record. User/session event records omit password and token hashes; UI-facing event records redact Owner/User PII.

```typescript
return ResultAsync.fromPromise(
  Promise.resolve().then(() =>
    db.transaction((tx) => {
      events.forEach((event) => {
        applyProjection(tx, event);
        tx.insert(domainEventsTable).values(toEventRecord(event)).run();
      });
    }),
  ),
  (cause): RepositoryError => ({ kind: "RepositoryError", operation: "Store", cause }),
);
```

- [ ] **Step 6: Verify transaction and boundary behavior**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/final/drizzle examples/final/src/adaptor/secondary/sqlite examples/final/test/adaptor/sqliteEventStore.test.ts examples/final/test/adaptor/sqliteResolver.test.ts
git commit -m "feat(final): イベントからSQLite projectionを原子的に更新"
```

### Task 7: Authentication and user-management use cases

**Files:**
- Create: `examples/final/src/useCase/setUpInitialAdminUseCase.ts`
- Create: `examples/final/src/useCase/logInUseCase.ts`
- Create: `examples/final/src/useCase/logOutUseCase.ts`
- Create: `examples/final/src/useCase/createUserUseCase.ts`
- Create: `examples/final/src/useCase/updateUserUseCase.ts`
- Create: `examples/final/src/useCase/resetUserPasswordUseCase.ts`
- Create: `examples/final/src/useCase/deleteUserUseCase.ts`
- Create: `examples/final/src/useCase/listUsersUseCase.ts`
- Create: `examples/final/test/useCase/authenticationUseCases.test.ts`
- Create: `examples/final/test/useCase/userManagementUseCases.test.ts`

**Interfaces:**
- Consumes: user/session resolver and store contracts plus `PasswordHasher`, `SessionTokenGenerator`, `Clock`, and ID generators
- Produces: setup/login/logout and admin user-management command/query use cases

- [ ] **Step 1: Write failing use case tests**

Cover setup only at zero users, login success/failure, 8-hour expiration, logout event, Admin-only management, veterinarian ID creation, profile/role update, password reset, self-delete rejection, last-admin rejection, session revocation on delete, and list output without password hashes.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/authenticationUseCases.test.ts test/useCase/userManagementUseCases.test.ts`

Expected: FAIL because the use cases do not exist.

- [ ] **Step 3: Implement all authentication and user-management pipelines**

Every command follows the Task 4 construction pattern. Setup generates the initial Admin and a session. The initial `UserCreated` event uses the generated Admin `userId` as `actorUserId`, because no earlier user exists. Login resolves by email, verifies password, and emits `SessionCreated`. Delete checks actor/target/admin count, emits `UserDeleted`, and relies on `UserDeletedStore` to delete sessions in the same transaction.

- [ ] **Step 4: Verify use case behavior**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/authenticationUseCases.test.ts test/useCase/userManagementUseCases.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/useCase/setUpInitialAdminUseCase.ts examples/final/src/useCase/logInUseCase.ts examples/final/src/useCase/logOutUseCase.ts examples/final/src/useCase/createUserUseCase.ts examples/final/src/useCase/updateUserUseCase.ts examples/final/src/useCase/resetUserPasswordUseCase.ts examples/final/src/useCase/deleteUserUseCase.ts examples/final/src/useCase/listUsersUseCase.ts examples/final/test/useCase/authenticationUseCases.test.ts examples/final/test/useCase/userManagementUseCases.test.ts
git commit -m "feat(final): セッション認証と管理者向けユーザー操作を追加"
```

### Task 8: Owner and pet management use cases

**Files:**
- Create: `examples/final/src/useCase/createOwnerUseCase.ts`
- Create: `examples/final/src/useCase/updateOwnerUseCase.ts`
- Create: `examples/final/src/useCase/deleteOwnerUseCase.ts`
- Create: `examples/final/src/useCase/listOwnersUseCase.ts`
- Create: `examples/final/src/useCase/getOwnerUseCase.ts`
- Create: `examples/final/src/useCase/createPetUseCase.ts`
- Create: `examples/final/src/useCase/updatePetUseCase.ts`
- Create: `examples/final/src/useCase/deletePetUseCase.ts`
- Create: `examples/final/src/useCase/listPetsUseCase.ts`
- Create: `examples/final/src/useCase/getPetUseCase.ts`
- Create: `examples/final/test/useCase/ownerPetUseCases.test.ts`

**Interfaces:**
- Consumes: `UserResolver`, `OwnerResolver`, `PetResolver`, `AppointmentResolver`, and owner/pet event stores
- Produces: Receptionist/Admin owner and pet commands plus query use cases

- [ ] **Step 1: Write failing owner/pet use case tests**

Cover authorized create/update/delete, unauthorized Veterinarian, missing owner on pet creation, owner deletion with remaining pets, pet deletion with active appointment, deletion with only terminal appointments, and PII-safe query DTOs.

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/ownerPetUseCases.test.ts`

Expected: FAIL because the management use cases do not exist.

- [ ] **Step 3: Implement commands and queries**

Commands emit `OwnerCreated/Updated/Deleted` or `PetCreated/Updated/Deleted` and pass only the event to the corresponding store. Query outputs explicitly unwrap only the PII needed by authorized pages and never expose domain objects containing password or token material.

- [ ] **Step 4: Verify owner/pet use cases**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/ownerPetUseCases.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/useCase/createOwnerUseCase.ts examples/final/src/useCase/updateOwnerUseCase.ts examples/final/src/useCase/deleteOwnerUseCase.ts examples/final/src/useCase/listOwnersUseCase.ts examples/final/src/useCase/getOwnerUseCase.ts examples/final/src/useCase/createPetUseCase.ts examples/final/src/useCase/updatePetUseCase.ts examples/final/src/useCase/deletePetUseCase.ts examples/final/src/useCase/listPetsUseCase.ts examples/final/src/useCase/getPetUseCase.ts examples/final/test/useCase/ownerPetUseCases.test.ts
git commit -m "feat(final): 飼い主とペットの管理use caseを追加"
```

### Task 9: Remaining appointment and follow-up use cases

**Files:**
- Create: `examples/final/src/useCase/bookAppointmentUseCase.ts`
- Create: `examples/final/src/useCase/checkInAppointmentUseCase.ts`
- Create: `examples/final/src/useCase/recordExamResultUseCase.ts`
- Create: `examples/final/src/useCase/recordPaymentUseCase.ts`
- Create: `examples/final/src/useCase/cancelAppointmentUseCase.ts`
- Create: `examples/final/src/useCase/requestFollowUpUseCase.ts`
- Create: `examples/final/src/useCase/listAppointmentsUseCase.ts`
- Create: `examples/final/src/useCase/getAppointmentUseCase.ts`
- Create: `examples/final/src/useCase/listFollowUpsUseCase.ts`
- Create: `examples/final/src/useCase/getDashboardUseCase.ts`
- Create: `examples/final/src/useCase/listEventsUseCase.ts`
- Create: `examples/final/test/useCase/appointmentUseCases.test.ts`
- Create: `examples/final/test/useCase/followUpUseCases.test.ts`

**Interfaces:**
- Consumes: all clinic resolvers, event-specific stores, `EventHistoryReader`, `FollowUpRequestReader`, `Clock`, and ID generators
- Produces: all remaining clinic command/query use cases and page DTOs

- [ ] **Step 1: Write failing lifecycle and follow-up tests**

Run one normal flow from booking through payment. Add individual tests for state conflicts, role rejection, pet-owner mismatch, exam result pet mismatch, cancellation, follow-up deduplication, event-history Admin restriction, and query fallback labels for deleted related records.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/appointmentUseCases.test.ts test/useCase/followUpUseCases.test.ts`

Expected: FAIL because the remaining clinic use cases do not exist.

- [ ] **Step 3: Implement commands**

Each command resolves the actor, checks permissions and current state, builds one event with injected clock/ID generator, calls its typed store, and maps `event.aggregateState` to `UseCaseOk`. `requestFollowUpUseCase` validates the entire candidate set before it stores `FollowUpRequested` events.

- [ ] **Step 4: Implement query DTOs**

Return page-specific readonly DTOs. Resolve related owner/pet/veterinarian names when present and return the literal label `削除済み` when only a historical ID remains. `listEventsUseCase` returns metadata and redacted state/payload only.

- [ ] **Step 5: Verify clinic use cases**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/useCase/appointmentUseCases.test.ts test/useCase/followUpUseCases.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/final/src/useCase/bookAppointmentUseCase.ts examples/final/src/useCase/checkInAppointmentUseCase.ts examples/final/src/useCase/recordExamResultUseCase.ts examples/final/src/useCase/recordPaymentUseCase.ts examples/final/src/useCase/cancelAppointmentUseCase.ts examples/final/src/useCase/requestFollowUpUseCase.ts examples/final/src/useCase/listAppointmentsUseCase.ts examples/final/src/useCase/getAppointmentUseCase.ts examples/final/src/useCase/listFollowUpsUseCase.ts examples/final/src/useCase/getDashboardUseCase.ts examples/final/src/useCase/listEventsUseCase.ts examples/final/test/useCase/appointmentUseCases.test.ts examples/final/test/useCase/followUpUseCases.test.ts
git commit -m "feat(final): 予約ライフサイクルと電話フォローを接続"
```

### Task 10: Hono/Inertia shell and authentication routes

**Files:**
- Create: `examples/final/src/adaptor/primary/web/rootView.tsx`
- Create: `examples/final/src/adaptor/primary/web/client.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages.gen.ts`
- Create: `examples/final/src/adaptor/primary/web/styles.css`
- Create: `examples/final/src/adaptor/primary/web/pageProps.ts`
- Create: `examples/final/src/adaptor/primary/web/middleware/authentication.ts`
- Create: `examples/final/src/adaptor/primary/web/middleware/sharedProps.ts`
- Create: `examples/final/src/adaptor/primary/web/middleware/useCaseResponse.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/authRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/dashboardRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/pages/Layout.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Setup.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Login.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Dashboard.tsx`
- Create: `examples/final/src/app.ts`
- Create: `examples/final/test/web/authRoutes.test.ts`

**Interfaces:**
- Consumes: setup/login/logout/dashboard use cases and all concrete secondary adaptors
- Produces: `createApp(dependencies)` and default Hono app, authenticated actor in context, Inertia shell

- [ ] **Step 1: Write failing Hono/Inertia auth tests**

Use `app.request`. Verify `/setup` is available only with zero users, successful setup/login sets an HttpOnly SameSite cookie, invalid login returns Inertia form errors, protected `/` redirects without a session, expired sessions redirect, logout clears the cookie, CSRF rejects a cross-origin form request, and response props omit hashes.

- [ ] **Step 2: Run web tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/authRoutes.test.ts`

Expected: FAIL because the app and routes do not exist.

- [ ] **Step 3: Implement root view, client bootstrap, and middleware**

Use `serializePage` in a script element with `data-page="app"`. In development load `/src/adaptor/primary/web/client.tsx`; production loads `/static/client.js` and `/static/styles.css`. Bootstrap React with `createInertiaApp` and `createRoot`. Configure Hono `csrf`, `secureHeaders`, and Inertia middleware before routes.

- [ ] **Step 4: Implement auth/dashboard routes and composition root**

Parse form data with Zod in the primary adaptor. Convert `ValidationError` to Inertia field errors, unauthenticated results to `/login`, unauthorized to 403, not-found to 404, conflict to 409, and repository failure to 500 through an exhaustive `switch` and `assertNever`.

- [ ] **Step 5: Verify web auth**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/authRoutes.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Expected: PASS and produce `dist/index.js`, `dist/static/client.js`, and `dist/static/styles.css`.

- [ ] **Step 6: Commit**

```bash
git add examples/final/src/adaptor/primary/web/rootView.tsx examples/final/src/adaptor/primary/web/client.tsx examples/final/src/adaptor/primary/web/styles.css examples/final/src/adaptor/primary/web/pageProps.ts examples/final/src/adaptor/primary/web/middleware examples/final/src/adaptor/primary/web/routes/authRoutes.ts examples/final/src/adaptor/primary/web/routes/dashboardRoutes.ts examples/final/src/adaptor/primary/web/pages/Layout.tsx examples/final/src/adaptor/primary/web/pages/Setup.tsx examples/final/src/adaptor/primary/web/pages/Login.tsx examples/final/src/adaptor/primary/web/pages/Dashboard.tsx examples/final/src/app.ts examples/final/test/web/authRoutes.test.ts
git commit -m "feat(final): HonoとInertiaへセッション認証を接続"
```

### Task 11: User, owner, and pet management pages

**Files:**
- Create: `examples/final/src/adaptor/primary/web/routes/userRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/ownerRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/petRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/pages/Users/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Users/Form.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Owners/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Owners/Form.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Pets/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Pets/Form.tsx`
- Create: `examples/final/test/web/managementRoutes.test.ts`

**Interfaces:**
- Consumes: Tasks 7 and 8 use cases
- Produces: Inertia CRUD pages and role-aware navigation/actions

- [ ] **Step 1: Write failing management route tests**

Verify Admin user CRUD, Receptionist owner/pet CRUD, Veterinarian 403 responses, field validation, physical deletion, self/last-admin conflict, owner-with-pets conflict, and pet-with-active-appointment conflict. Check response bodies never contain password hashes.

- [ ] **Step 2: Run the route test and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/managementRoutes.test.ts`

Expected: FAIL because the routes and pages do not exist.

- [ ] **Step 3: Implement routes and React pages**

Use Inertia `Link` and `useForm`; do not add `fetch`, React Router, or a client data cache. Forms send POST/PATCH/DELETE to Hono. `Layout` shows navigation items and actions based on shared actor permissions, while server use cases remain authoritative.

- [ ] **Step 4: Verify management flows**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/managementRoutes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/adaptor/primary/web/routes/userRoutes.ts examples/final/src/adaptor/primary/web/routes/ownerRoutes.ts examples/final/src/adaptor/primary/web/routes/petRoutes.ts examples/final/src/adaptor/primary/web/pages/Users examples/final/src/adaptor/primary/web/pages/Owners examples/final/src/adaptor/primary/web/pages/Pets examples/final/test/web/managementRoutes.test.ts
git commit -m "feat(final): ユーザーと患者の管理画面を追加"
```

### Task 12: Appointment, follow-up, and event-history pages

**Files:**
- Create: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/followUpRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/eventRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Appointments/New.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/FollowUps/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Create: `examples/final/test/web/clinicFlow.test.ts`
- Create: `examples/final/test/web/securityBoundary.test.ts`

**Interfaces:**
- Consumes: Task 4 and Task 9 use cases
- Produces: complete Inertia clinic workflow, admin event audit page

- [ ] **Step 1: Write failing end-to-end route tests**

Drive setup/login, owner and pet creation, booking, check-in, examination start, exam result, payment, follow-up request, and event listing through `app.request`. Add role-specific rejection tests and assert state-specific actions disappear after each transition.

- [ ] **Step 2: Write failing security boundary tests**

Search every Inertia response from the flow for the known owner email, phone, password hash, and session token hash. The owner pages may expose authorized owner contact fields, but dashboard, event history, error responses, and logs must not. Verify event history contains event names and IDs with redacted state/payload.

- [ ] **Step 3: Run web flow tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts`

Expected: FAIL because clinic routes and pages do not exist.

- [ ] **Step 4: Implement appointment routes and state-aware pages**

Render only valid actions for the current appointment `kind` and actor permissions. Parse each action with its own Zod schema. Redirect to the appointment detail after successful mutation and preserve validation errors through Inertia.

- [ ] **Step 5: Implement follow-up and event routes/pages**

Follow-up index shows validated targets and posts selected IDs to `requestFollowUpUseCase`. Event history is Admin-only and renders event ID, aggregate ID/name, event name, occurred time, and actor ID; it never renders raw event JSON.

- [ ] **Step 6: Verify full web behavior**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts examples/final/src/adaptor/primary/web/routes/followUpRoutes.ts examples/final/src/adaptor/primary/web/routes/eventRoutes.ts examples/final/src/adaptor/primary/web/pages/Appointments examples/final/src/adaptor/primary/web/pages/FollowUps examples/final/src/adaptor/primary/web/pages/Events examples/final/test/web/clinicFlow.test.ts examples/final/test/web/securityBoundary.test.ts
git commit -m "feat(final): 動物病院の全業務をInertia画面へ接続"
```

### Task 13: Remove the old snapshot layout and synchronize participant docs

**Files:**
- Delete: `examples/final/src/application/collect-follow-up-targets-error.ts`
- Delete: `examples/final/src/application/collect-follow-up-targets.ts`
- Delete: `examples/final/src/application/follow-up-candidate.ts`
- Delete: `examples/final/src/application/follow-up-target.ts`
- Delete: `examples/final/src/application/start-examination-error.ts`
- Delete: `examples/final/src/application/start-examination-input.ts`
- Delete: `examples/final/src/application/start-examination.ts`
- Delete: `examples/final/src/ports/appointment-resolver.ts`
- Delete: `examples/final/src/ports/appointment-store.ts`
- Delete: `examples/final/src/infrastructure/in-memory-appointment-gateway.ts`
- Delete: `examples/final/src/domain/appointment-id.ts`
- Delete: `examples/final/src/domain/appointment.ts`
- Delete: `examples/final/src/domain/clinic-domain-event.ts`
- Delete: `examples/final/src/domain/exam-id.ts`
- Delete: `examples/final/src/domain/exam-result.ts`
- Delete: `examples/final/src/domain/examination-started.ts`
- Delete: `examples/final/src/domain/event-id.ts`
- Delete: `examples/final/src/domain/follow-up-requested.ts`
- Delete: `examples/final/src/domain/owner-contact.ts`
- Delete: `examples/final/src/domain/owner-email.ts`
- Delete: `examples/final/src/domain/owner-id.ts`
- Delete: `examples/final/src/domain/owner-name.ts`
- Delete: `examples/final/src/domain/owner-phone.ts`
- Delete: `examples/final/src/domain/payment-amount.ts`
- Delete: `examples/final/src/domain/pet-id.ts`
- Delete: `examples/final/src/domain/timestamp.ts`
- Delete: `examples/final/src/domain/veterinarian-id.ts`
- Delete: `examples/final/src/shared/schema-result.ts`
- Delete: `examples/final/src/shared/sensitive.ts`
- Delete: `examples/final/test/boundary-defense.test.ts`
- Delete: `examples/final/test/fixtures.ts`
- Delete: `examples/final/test/follow-up.test.ts`
- Delete: `examples/final/test/start-examination.test.ts`
- Delete: `examples/final/test/state-modeling.test.ts`
- Modify: `examples/final/README.md`
- Modify: `apps/docs/src/pages/sessions/final.astro`
- Modify: `apps/docs/src/test/pages/sessions/final.test.ts`
- Modify: `apps/docs/src/code-explorer/session-workspaces.ts`
- Modify: `apps/docs/src/code-explorer/session-workspaces.test.ts`

**Interfaces:**
- Produces: one canonical final implementation and participant documentation matching its real paths/commands

- [ ] **Step 1: Update docs tests for the new structure and commands**

Expect the final page to mention `domain`, `adaptor/primary`, `adaptor/secondary`, `useCase`, `app.ts`, `StartExaminationUseCase`, `ResultAsync`, Drizzle transaction, `pnpm --filter @fp-with-ts/clinic-final dev`, setup/login, and role names. Update code-explorer file paths to the new domain/useCase files.

- [ ] **Step 2: Run docs tests and confirm failure**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/sessions/final.test.ts src/code-explorer/session-workspaces.test.ts`

Expected: FAIL because the public page still describes the old snapshot layout.

- [ ] **Step 3: Remove obsolete files and update README/public docs**

Explain the runtime app flow, first-admin setup, default file SQLite location, dev/build/test/typecheck commands, event-driven store contract, folder responsibilities, and deletion/event-retention distinction. Replace old code blocks with exact excerpts from `appointment.ts` and `startExaminationUseCase.ts`.

- [ ] **Step 4: Verify docs and package**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/sessions/final.test.ts src/code-explorer/session-workspaces.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: PASS.

- [ ] **Step 5: Run Kamae static checks before review**

Run: `rg --pcre2 -n "\\binterface\\b|\\bthrow new\\b|\\bas (?!const\\b)" examples/final/src --glob '*.ts' --glob '*.tsx'`

Expected: no domain/useCase violations. Framework-required `as` usage must be removed through parsing or isolated with an explanatory comment if a third-party type makes it unavoidable.

Run: `rg -n "console\\.|JSON.stringify\\(|logger\\." examples/final/src --glob '*.ts' --glob '*.tsx'`

Expected: no PII-bearing logging or raw event serialization.

- [ ] **Step 6: Commit**

```bash
git add examples/final apps/docs/src/pages/sessions/final.astro apps/docs/src/test/pages/sessions/final.test.ts apps/docs/src/code-explorer/session-workspaces.ts apps/docs/src/code-explorer/session-workspaces.test.ts
git commit -m "docs(final): 実行可能な完成例へ教材説明を同期"
```

### Task 14: Kamae review, full verification, and delivery

**Files:**
- Review: `examples/final/src/domain/**/*.ts`
- Review: `examples/final/src/useCase/**/*.ts`
- Review: `examples/final/src/adaptor/secondary/**/*.ts`
- Review: `examples/final/src/adaptor/primary/web/routes/**/*.ts`
- Review: `examples/final/test/**/*.ts`

**Interfaces:**
- Produces: Kamae-reviewed implementation with all repository quality gates passing

- [ ] **Step 1: Run `kamae-review` against the completed server-side TypeScript**

Walk every checklist item for domain modeling, state transitions, errors, boundaries, PII, declarative code, and fixtures. Record each finding as `path:line`, principle, risk, and correction. Fix all High and Medium findings and any Low finding that does not require a documented deviation.

- [ ] **Step 2: Re-run focused final package checks**

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Expected: PASS.

- [ ] **Step 3: Run repository-wide verification**

Run: `pnpm typecheck`

Expected: PASS.

Run: `pnpm test`

Expected: PASS. `exercise:00` is not part of this command and remains intentionally failing when run separately.

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 4: Commit review corrections when needed**

```bash
git add examples/final apps/docs pnpm-lock.yaml
git commit -m "fix(final): 境界検証とPII保護のレビュー結果を反映"
```

Skip this commit only when the review produces no file changes.

- [ ] **Step 5: Inspect the final diff and status**

Run: `git diff --check origin/main...HEAD`

Expected: no whitespace errors.

Run: `git status --short`

Expected: no uncommitted files after the review fixes are committed.

- [ ] **Step 6: Push and create or update the Draft Pull Request**

Push `codex/feat-final-hono-inertia-drizzle`. If the branch has no open Pull Request, create a Draft Pull Request with the sections `背景`、`内容`、`論点`. If one already exists, update it instead of creating another.
