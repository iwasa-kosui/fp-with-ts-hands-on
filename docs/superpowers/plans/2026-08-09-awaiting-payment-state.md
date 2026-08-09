# AwaitingPayment State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 診察結果の記録で予約を `AwaitingPayment` へ進め、診察結果・予約 projection・両イベントを原子的に保存して重複送信を防ぐ。

**Architecture:** `Appointment` の判別共用体へ `AwaitingPayment` を追加し、`ExamId` を予約 state に保持する。`RecordExamResultUseCase` が `ExamResultRecorded` と `AppointmentExaminationCompleted` を生成し、専用 SQLite store が一 transaction で両 projection と両イベントを保存する。会計は `AwaitingPayment` だけから `Paid` へ進む。

**Tech Stack:** TypeScript 5、neverthrow `ResultAsync`、Zod、Hono、Inertia、React、Drizzle ORM、better-sqlite3、Vitest

## Global Constraints

- すべての domain state、event、DTO、port は `Readonly` な `type` と関数プロパティで表す。
- ID と時刻は既存の branded schema を使い、外部入力と SQLite 復元時に Zod で検証する。
- 診療自由記述は `Sensitive` のまま domain/useCase を通し、SQLite projection と許可済み page DTO だけで unwrap する。
- `domain_events` は追記専用とし、operational state の再生・rehydration・compaction・event resolver を追加しない。
- 既存の診察結果 projection と監査イベントは変更・削除・自動 backfill しない。
- 1 public resolver/read port は1メソッドのまま維持する。
- 各 task は test-first で RED を確認し、GREEN、自己レビュー、focused verification、コミット、push まで行う。

---

### Task 1: Appointment の5状態とイベント

**Files:**
- Modify: `examples/final/src/domain/appointment/appointment.ts`
- Modify: `examples/final/src/domain/appointment/appointmentEvent.ts`
- Modify: `examples/final/src/domain/appointment/appointmentStores.ts`
- Modify: `examples/final/test/domain/appointment.test.ts`

**Interfaces:**
- Consumes: 既存 `EventContext`、`ExamId`、`InExamination`。
- Produces: `AwaitingPayment`、`AppointmentExaminationCompleted`、`Appointment.completeExamination(context)(appointment, { examId })`、`Appointment.recordPayment(context)(awaitingPayment, input)`。

- [ ] **Step 1: `InExamination → AwaitingPayment → Paid` の RED test を追加する**

```typescript
const completion = Appointment.completeExamination(completionContext)(
  examining.aggregateState,
  { examId },
);
const paid = Appointment.recordPayment(paymentContext)(
  completion.aggregateState,
  { diagnosis, treatment, amount: paymentAmount },
);

expect(completion).toMatchObject({
  kind: "AppointmentExaminationCompleted",
  aggregateState: {
    kind: "AwaitingPayment",
    examId,
    examinationCompletedAt: completionContext.occurredAt,
  },
  eventName: "appointment.examination-completed",
});
expect(paid.aggregateState).toMatchObject({
  kind: "Paid",
  examId,
  examinationCompletedAt: completionContext.occurredAt,
});

// @ts-expect-error InExamination から直接会計できません。
Appointment.recordPayment(paymentContext)(examining.aggregateState, paymentInput);
```

- [ ] **Step 2: domain test の RED を確認する**

Run: `pnpm exec vitest run test/domain/appointment.test.ts`

Expected: `Appointment.completeExamination` と `AwaitingPayment` が未定義で FAIL。

- [ ] **Step 3: 5状態と純粋遷移を実装する**

```typescript
export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
}>;

const completeExamination =
  (context: EventContext) =>
  (
    appointment: InExamination,
    input: Readonly<{ examId: ExamId }>,
  ): AppointmentExaminationCompleted => {
    const aggregateState = {
      ...appointment,
      kind: "AwaitingPayment",
      examId: input.examId,
      examinationCompletedAt: context.occurredAt,
    } as const satisfies AwaitingPayment;
    return AppointmentEvent.create(
      context,
      appointment.appointmentId,
      aggregateState,
      "AppointmentExaminationCompleted",
      "appointment.examination-completed",
      { appointmentId: appointment.appointmentId, examId: input.examId },
    );
  };
```

`Paid` は `AwaitingPayment` の時系列フィールドを保持し、`isActive` は `AwaitingPayment` も active と判定する。

- [ ] **Step 4: domain test と package typecheck の GREEN を確認する**

Run: `pnpm exec vitest run test/domain/appointment.test.ts && pnpm typecheck`

Expected: PASS。

- [ ] **Step 5: Task 1 をコミット・push する**

```bash
git add examples/final/src/domain/appointment/appointment.ts examples/final/src/domain/appointment/appointmentEvent.ts examples/final/src/domain/appointment/appointmentStores.ts examples/final/test/domain/appointment.test.ts
git commit -m "feat(final): 会計待ちの予約状態を追加"
git push
```

### Task 2: 2イベントを生成する RecordExamResultUseCase

**Files:**
- Modify: `examples/final/src/domain/examResult/examResultStores.ts`
- Modify: `examples/final/src/useCase/recordExamResultUseCase.ts`
- Modify: `examples/final/src/useCase/recordPaymentUseCase.ts`
- Modify: `examples/final/test/useCase/appointmentUseCases.test.ts`

**Interfaces:**
- Consumes: Task 1 の `Appointment.completeExamination` と `AppointmentExaminationCompleted`。
- Produces: `ExaminationCompletionStore.store(examResultEvent, appointmentEvent)`、`RecordExamResultUseCase` 成功値 `{ examResult, appointment }`、typed `AppointmentConflict`。

- [ ] **Step 1: paired event、例外、stale conflict の RED tests を追加する**

```typescript
const stored: Array<readonly [ExamResultRecorded, AppointmentExaminationCompleted]> = [];
const useCase = RecordExamResultUseCase.create({
  ...dependencies,
  examinationCompletionStore: {
    store: (examEvent, appointmentEvent) => {
      stored.push([examEvent, appointmentEvent]);
      return okAsync(undefined);
    },
  },
});

const result = await useCase.run(input);
expect(result._unsafeUnwrap().appointment.kind).toBe("AwaitingPayment");
expect(stored[0]?.map((event) => event.kind)).toEqual([
  "ExamResultRecorded",
  "AppointmentExaminationCompleted",
]);
```

Generator/clock throw では `IdentityGenerationFailed`、store conflict では同じ `AppointmentConflict`、認可・pet mismatch では generator/clock/store が未呼び出しであることを検証する。`RecordPaymentUseCase` は `InExamination` を `InvalidAppointmentState` とし、`AwaitingPayment` を成功させる。

- [ ] **Step 2: useCase test の RED を確認する**

Run: `pnpm exec vitest run test/useCase/appointmentUseCases.test.ts`

Expected: 新 port、成功値、`AwaitingPayment` 前提が未実装で FAIL。

- [ ] **Step 3: event-first port と useCase pipeline を実装する**

```typescript
export type ExaminationCompletionStore = Readonly<{
  store: (
    examResult: ExamResultRecorded,
    appointment: AppointmentExaminationCompleted,
  ) => ResultAsync<void, AppointmentStoreError>;
}>;
```

`RecordExamResultUseCase.run` は actor と appointment を解決・認可・pet 照合した後、deferred `ResultAsync.fromPromise` 内で `examId`、2 event ID、1 timestamp を生成し、`ExamResultRecorded` と `AppointmentExaminationCompleted` を作る。`andThrough` で一度だけ `examinationCompletionStore.store` を呼び、`AppointmentConflict` を維持して返す。

- [ ] **Step 4: useCase test と typecheck の GREEN を確認する**

Run: `pnpm exec vitest run test/useCase/appointmentUseCases.test.ts test/useCase/startExaminationUseCase.test.ts && pnpm typecheck`

Expected: PASS。

- [ ] **Step 5: Task 2 をコミット・push する**

```bash
git add examples/final/src/domain/examResult/examResultStores.ts examples/final/src/useCase/recordExamResultUseCase.ts examples/final/src/useCase/recordPaymentUseCase.ts examples/final/test/useCase/appointmentUseCases.test.ts
git commit -m "feat(final): 診察完了イベントを同時生成"
git push
```

### Task 3: SQLite の原子保存と厳密な復元

**Files:**
- Create: `examples/final/src/adaptor/secondary/sqlite/store/examinationCompletionStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/persistedEventRow.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/schema.ts`
- Modify: `examples/final/src/app.ts`
- Modify: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Modify: `examples/final/test/adaptor/sqliteResolver.test.ts`
- Modify: `examples/final/test/integration/fileSqliteSmoke.test.ts`

**Interfaces:**
- Consumes: Task 2 の `ExaminationCompletionStore`。
- Produces: `createExaminationCompletionStore(database)` と、`AwaitingPayment` を扱う projection/event parsers。

- [ ] **Step 1: atomicity、競合、復元の RED tests を追加する**

```typescript
const [first, second] = await Promise.all([
  store.store(firstExamEvent, firstCompletionEvent),
  store.store(secondExamEvent, secondCompletionEvent),
]);
expect([first, second].filter((result) => result.isOk())).toHaveLength(1);
expect(database.select().from(examResultsTable).all()).toHaveLength(1);
expect(database.select().from(domainEventsTable).all().slice(-2).map((row) => row.eventName))
  .toEqual(["exam-result.recorded", "appointment.examination-completed"]);
expect(resolved._unsafeUnwrap()?.kind).toBe("AwaitingPayment");
```

重複 event ID で後半の insert を失敗させ、予約が `InExamination` のまま、診察結果0件、新規イベント0件へ rollback されることも検証する。既存 file DB row は migration 後も件数・内容が変わらないことを検証する。

- [ ] **Step 2: SQLite focused tests の RED を確認する**

Run: `pnpm exec vitest run test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts test/integration/fileSqliteSmoke.test.ts`

Expected: factory と `AwaitingPayment` schema が未定義で FAIL。

- [ ] **Step 3: transaction store と境界 schema を実装する**

```typescript
export const createExaminationCompletionStore = (db: SqliteDatabase) => ({
  store: (examEvent, appointmentEvent) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => db.transaction((tx) => {
        const changes = tx.update(appointmentsTable)
          .set(toAwaitingPaymentValues(appointmentEvent.aggregateState))
          .where(and(
            eq(appointmentsTable.appointmentId, appointmentEvent.aggregateId),
            eq(appointmentsTable.status, "InExamination"),
          ))
          .run().changes;
        if (changes !== 1) throw appointmentConflict(appointmentEvent.aggregateId);
        tx.insert(examResultsTable).values(toExamResultValues(examEvent)).run();
        tx.insert(domainEventsTable).values(toEventRecord(examEvent, safeExamState, safeExamPayload)).run();
        tx.insert(domainEventsTable).values(toEventRecord(appointmentEvent, safeAppointmentState, safeAppointmentPayload)).run();
      })),
      parseStoreError,
    ),
});
```

schema/resolver/audit parser は `AwaitingPayment` の `examId` と `examinationCompletedAt` を必須検証する。`AppointmentEventStore` の通常 port から completion event を保存せず、composition root は `RecordExamResultUseCase` へ専用 store のみ注入する。

- [ ] **Step 4: SQLite tests と typecheck の GREEN を確認する**

Run: `pnpm exec vitest run test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts test/integration/fileSqliteSmoke.test.ts && pnpm typecheck`

Expected: PASS。

- [ ] **Step 5: Task 3 をコミット・push する**

```bash
git add examples/final/src/adaptor/secondary/sqlite/store/examinationCompletionStore.ts examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts examples/final/src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts examples/final/src/adaptor/secondary/sqlite/query/persistedEventRow.ts examples/final/src/adaptor/secondary/sqlite/schema.ts examples/final/src/app.ts examples/final/test/adaptor/sqliteEventStore.test.ts examples/final/test/adaptor/sqliteResolver.test.ts examples/final/test/integration/fileSqliteSmoke.test.ts
git commit -m "feat(final): 診察結果と会計待ちを原子的に保存"
git push
```

### Task 4: Query、HTTP/UI、公開ドキュメント

**Files:**
- Modify: `examples/final/src/useCase/listAppointmentsUseCase.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- Modify: `examples/final/test/web/clinicFlow.test.ts`
- Modify: `examples/final/test/web/securityBoundary.test.ts`
- Modify: `examples/final/test/web/managementPages.test.tsx`
- Modify: `examples/final/README.md`
- Modify: `apps/docs/src/pages/sessions/final.astro`
- Modify: `apps/docs/src/test/pages/sessions/final.test.ts`

**Interfaces:**
- Consumes: `AwaitingPayment` appointment view、typed `AppointmentConflict`。
- Produces: 5-state allowlisted `AppointmentView`/`AppointmentPageView`、state-specific actions と SSR、同期した公開説明。

- [ ] **Step 1: route、SSR、docs の RED tests を追加する**

```typescript
expect(afterExamResult.props.appointment).toMatchObject({
  kind: "AwaitingPayment",
  examId,
});
expect(afterExamResult.props.actions).toMatchObject({
  recordExamResult: false,
  recordPayment: true,
});
expect(await renderAppointmentShow(veterinarianProps)).toContain("会計待ち");
expect(await renderAppointmentShow(veterinarianProps)).not.toContain("診察結果を記録");
```

同じ Inertia POST を並行送信して一方が303成功、他方が `?error=appointment-conflict` への303となり、診察結果が1件だけであることを real Hono + SQLite で検証する。docs test は `Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid` を要求する。

- [ ] **Step 2: web/docs focused tests の RED を確認する**

Run: `pnpm exec vitest run test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts test/web/managementPages.test.tsx && pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/sessions/final.test.ts`

Expected: DTO switch、action、SSR、公開文言が4状態のため FAIL。

- [ ] **Step 3: 5-state DTO、route、SSR、docs を実装する**

`AppointmentView` と `AppointmentPageView` に必須 `examId` / `examinationCompletedAt` を持つ `AwaitingPayment` variant を追加し、すべての switch を `assertNever` で網羅する。`actionsFor` は `recordExamResult` を `InExamination` だけ、`recordPayment` を manager + `AwaitingPayment` だけにする。診察結果 route は `AppointmentConflict` を allowlisted query error へ303で写像する。Show は `AwaitingPayment` の診察完了時刻と「診察結果記録済み・会計待ち」を表示する。

- [ ] **Step 4: focused tests と package gates の GREEN を確認する**

Run: `pnpm exec vitest run test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts test/web/managementPages.test.tsx && pnpm typecheck && pnpm test && pnpm build`

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/sessions/final.test.ts`

Expected: final package 全 test と client/SSR/app-artifact build、docs focused test が PASS。

- [ ] **Step 5: Kamae adversarial self-review を実施する**

`kamae-review` の6 checklist で domain/useCase/SQLite/HTTP diff を確認し、特に invalid optional state、throw 漏れ、PII unwrap、境界 schema、非原子的 store、non-exhaustive switch が0件であることを確認する。finding があれば別の RED/GREEN fix commit にする。

- [ ] **Step 6: root gates を実行する**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: examples、docs、worker の全 gate が PASS。

- [ ] **Step 7: Task 4 をコミット・push する**

```bash
git add examples/final/src/useCase/listAppointmentsUseCase.ts examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx examples/final/test/web/clinicFlow.test.ts examples/final/test/web/securityBoundary.test.ts examples/final/test/web/managementPages.test.tsx examples/final/README.md apps/docs/src/pages/sessions/final.astro apps/docs/src/test/pages/sessions/final.test.ts
git commit -m "feat(final): 診察完了から会計待ちへ進める"
git push
```
