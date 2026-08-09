# `examples/final` 予約カレンダー・受付ボード実装計画

> **実装担当者へ:** この計画は `superpowers:subagent-driven-development` または `superpowers:executing-plans` を使い、チェックボックス単位で実行してください。

**Goal:** `examples/final` に、予約カレンダー、縦型受付ボード、担当獣医師の重複防止、飛び込み受付、予防接種の前受金と差額精算、機微監査ペイロードの分離・開示監査を追加する。

**Architecture:** 既存の `Appointment` 集約を予約と来院の共通モデルとして拡張し、診療状態と支払状態を直積で保持する。command は typed event を作り、SQLite store が `BEGIN IMMEDIATE` transaction 内でversion、時間帯重複、projection、監査イベントを同時に確定する。画面向けqueryは command resolverから分離し、予約カレンダー用と受付ボード用のread portを追加する。監査イベントのメタデータは `domain_events`、全状態と全ペイロードはイベント単位の分類に従い通常または機微の一方のテーブルへ保存する。

**Tech Stack:** TypeScript 5、neverthrow `Result` / `ResultAsync`、Zod、Hono、Inertia React 3、React 19、Drizzle ORM、better-sqlite3、Vitest、CSS custom properties

**Approved spec:** `docs/superpowers/specs/2026-08-09-final-appointment-calendar-reception-board-design.md`

## Global Constraints

- フロントエンドでは状態、ロール、診療メニュー、支払状態、既知のイベント名、エラーを日本語で表示する。内部コードとURLは英字のままにする。
- `Appointment`、event、DTO、portは `Readonly` な `type` と関数プロパティで表し、class、可変domain state、例外による予期可能な失敗を追加しない。
- 外部入力とSQLite復元時はZodで検証し、IDは既存のbranded typeを使う。型アサーションで入力検証を迂回しない。
- 来院理由、受付メモ、診断、処置、診察結果、氏名、連絡先などの機微値はdomain/use case内では `Sensitive` のまま扱う。監査保存時だけ専用serializerで明示的にunwrapし、通常のJSON化、URL、エラー、ログへ出さない。
- 移行前の監査行は、当時保存されなかったPIIや自由記述を復元できない。既存JSONを改変せず機微テーブルへ移し、migration後に生成するeventから全state/payloadを保存する。
- `domain_events` は追記専用の監査索引であり、集約のrehydration、event replay、compactionは追加しない。現在状態は引き続きprojectionから読む。
- イベント分類をstore呼び出し側から渡さない。中央のallowlistだけが `Regular` を返し、未知のイベント名は必ず `Sensitive` とする。
- 同一獣医師の重複確認と書込みは `db.transaction(callback, { behavior: "immediate" })` 内で実行する。時間帯は `[startsAt, endsAt)` とし、候補または既存予約の担当医が未定なら競合対象外とする。
- すべての予約更新は `expectedVersion` を検証し、`appointments.version` とJSON stateのversionを同じtransactionで1増やす。
- 事前会計は予防接種の `Scheduled` / `CheckedIn` に一度だけ許可する。最終精算額と差額はサーバーが再計算する。前受済みキャンセルは全額返金を含む一つの状態変更・監査イベントとして同じtransactionで確定する。
- 既存のページpropsとserver-projected action方針を維持し、React側で認可を再実装しない。
- 新しいruntime dependency、WebSocket、ドラッグ操作、外部決済、暗号化SQLiteは追加しない。
- `pages.gen.ts` は生成物である。手編集せず、Vite buildで更新された場合だけstageする。
- 各TaskはRED確認、最小実装、自己レビュー、focused verification、Conventional Commit、pushの順に完了する。

## Preflight

計画作成時点では、rootの `pnpm test` に `examples/final/test/web/clinicFlow.test.ts` の「303を期待して302」になる既知の2失敗があった。実装開始時に次を再実行し、現在のbaselineを記録する。予約routeを変更するTask 4・5で、期待する303 redirectを明示したテストへ統合し、最終Taskでは既知失敗として残さない。

```bash
pnpm --filter @fp-with-ts/clinic-final exec vitest run test/web/clinicFlow.test.ts
git status --short
```

## Dependency Order

```text
Task 1 domain primitives
  ├─ Task 3 versioned appointment model
  │    ├─ Task 4 scheduling commands/forms
  │    ├─ Task 5 workflow/settlement/detail
  │    ├─ Task 6 calendar query/UI
  │    └─ Task 7 reception query/UI
  └─ Task 2 audit split ── Task 8 sensitive disclosure

Task 4–8 ── Task 9 integration/Japanese boundary ── Task 10 docs/full verification
```

---

### Task 1: 予約時間・診療メニュー・支払状態のdomain primitives

**Files:**

- Create: `examples/final/src/domain/appointment/serviceCode.ts`
- Create: `examples/final/src/domain/appointment/appointmentDuration.ts`
- Create: `examples/final/src/domain/appointment/bookingKind.ts`
- Create: `examples/final/src/domain/appointment/receptionNote.ts`
- Create: `examples/final/src/domain/appointment/appointmentVersion.ts`
- Create: `examples/final/src/domain/appointment/settlementAdjustmentAmount.ts`
- Create: `examples/final/src/domain/appointment/settlementState.ts`
- Create: `examples/final/src/domain/appointment/appointmentSchedule.ts`
- Create: `examples/final/test/domain/appointmentSchedule.test.ts`
- Modify: `examples/final/test/domain/appointment.test.ts`

**Interfaces:**

```typescript
export type ServiceCode =
  | "GeneralConsultation"
  | "FollowUpVisit"
  | "Vaccination"
  | "ExaminationOrProcedure";

export type AppointmentDuration = 15 | 30 | 45 | 60;
export type BookingKind = "Reserved" | "WalkIn";
export type AppointmentVersion = number & z.BRAND<"AppointmentVersion">;
export type SettlementAdjustmentAmount = number & z.BRAND<"SettlementAdjustmentAmount">;

export type SettlementState =
  | Readonly<{ kind: "NoPayment" }>
  | Readonly<{
      kind: "DepositReceived";
      depositAmount: PaymentAmount;
      receivedAt: Timestamp;
    }>
  | Readonly<{
      kind: "Settled";
      finalAmount: PaymentAmount;
      depositAmount: SettlementAdjustmentAmount;
      additionalPaymentAmount: SettlementAdjustmentAmount;
      refundAmount: SettlementAdjustmentAmount;
      settledAt: Timestamp;
    }>
  | Readonly<{
      kind: "DepositRefunded";
      depositAmount: PaymentAmount;
      refundedAt: Timestamp;
    }>;
```

- [ ] **Step 1: 診療メニュー、所要時間、半開区間、差額計算のRED testsを追加する**

```typescript
expect(ServiceMenu.defaultDuration("GeneralConsultation")).toBe(30);
expect(ServiceMenu.defaultDuration("FollowUpVisit")).toBe(15);
expect(ServiceMenu.defaultDuration("Vaccination")).toBe(15);
expect(ServiceMenu.defaultDuration("ExaminationOrProcedure")).toBe(60);

expect(AppointmentSchedule.overlaps(
  schedule("2026-08-09T01:00:00.000Z", 30),
  schedule("2026-08-09T01:30:00.000Z", 30),
)).toBe(false);
expect(AppointmentSchedule.overlaps(
  schedule("2026-08-09T01:00:00.000Z", 30),
  schedule("2026-08-09T01:29:00.000Z", 15),
)).toBe(true);

expect(Settlement.settle(noPayment, amount(5000), settledAt)).toMatchObject({
  kind: "Settled",
  depositAmount: 0,
  additionalPaymentAmount: 5000,
  refundAmount: 0,
});
expect(Settlement.settle(deposit(7000), amount(5000), settledAt)).toMatchObject({
  additionalPaymentAmount: 0,
  refundAmount: 2000,
});
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointmentSchedule.test.ts test/domain/appointment.test.ts`

Expected: 新しいmoduleが存在しないためFAIL。

- [ ] **Step 3: Zod境界と純粋関数を実装する**

`AppointmentDuration.schema` は15、30、45、60だけを受け付ける。`AppointmentVersion.schema` は正の整数、`SettlementAdjustmentAmount.schema` は0以上の整数、既存 `PaymentAmount.schema` は正の整数のままにする。`ReceptionNote.schema` はtrim後1〜1000文字を `Sensitive.of` で包み、空文字のnull化はHTTP境界で行う。

```typescript
const overlaps = (left: AppointmentSchedule, right: AppointmentSchedule): boolean =>
  left.startsAt < endsAt(right) && right.startsAt < endsAt(left);

const settle = (
  current: NoPayment | DepositReceived,
  finalAmount: PaymentAmount,
  settledAt: Timestamp,
): Settled => {
  const deposit = current.kind === "DepositReceived" ? current.depositAmount : 0;
  return {
    kind: "Settled",
    finalAmount,
    depositAmount: SettlementAdjustmentAmount.schema.parse(deposit),
    additionalPaymentAmount: SettlementAdjustmentAmount.schema.parse(
      Math.max(finalAmount - deposit, 0),
    ),
    refundAmount: SettlementAdjustmentAmount.schema.parse(
      Math.max(deposit - finalAmount, 0),
    ),
    settledAt,
  };
};
```

- [ ] **Step 4: focused testsとpackage typecheckをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointmentSchedule.test.ts test/domain/appointment.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 5: checkpointをcommit/pushする**

```bash
git add examples/final/src/domain/appointment examples/final/test/domain/appointmentSchedule.test.ts examples/final/test/domain/appointment.test.ts
git commit -m "feat(final): 予約枠と精算の値型を追加"
git push
```

---

### Task 2: 監査メタデータと通常・機微ペイロードを分離する

**Files:**

- Modify: `examples/final/src/adaptor/secondary/sqlite/schema.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/eventPersistence.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/eventRecord.ts`
- Modify: `examples/final/src/domain/shared/sensitive.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/persistedEventRow.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/eventHistoryReader.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/sessionEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/initialAdminSetupStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/userEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/ownerEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/petEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/examinationCompletionStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/examResultEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/followUpEventStore.ts`
- Modify: `examples/final/src/useCase/query/eventHistoryReader.ts`
- Modify: `examples/final/src/useCase/listEventsUseCase.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/eventRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/eventPresentation.ts`
- Create: `examples/final/drizzle/0004_audit_payload_split.sql`
- Modify: `examples/final/drizzle/meta/_journal.json`
- Modify: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Modify: `examples/final/test/integration/fileSqliteSmoke.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Interfaces:**

```typescript
export type PayloadSensitivity = "Regular" | "Sensitive";

export type AuditEventSummary = Readonly<{
  eventId: EventId;
  aggregateId: string;
  aggregateName: string;
  eventName: string;
  occurredAt: Timestamp;
  actorUserId: UserId;
  payloadSensitivity: PayloadSensitivity;
  regularPayload?: Readonly<{
    aggregateState: unknown | null;
    eventPayload: Readonly<Record<string, unknown>>;
  }>;
}>;
```

通常allowlistは、このTaskでは空集合から始める。既存イベントはsessionを含めて状態または識別子を持つためすべて `Sensitive` とする。Task 8で追加する `audit.sensitive-payload-viewed` だけを `Regular` allowlistへ追加する。未知のイベント名は集合に含まれないため自動的に `Sensitive` になる。

- [ ] **Step 1: 監査テーブル分離と全文保存のRED testsを追加する**

```typescript
const metadata = db.select().from(domainEventsTable).all();
const regular = db.select().from(domainEventPayloadsTable).all();
const sensitive = db.select().from(domainEventSensitivePayloadsTable).all();

expect(metadata[0]).not.toHaveProperty("aggregateState");
expect(metadata[0]).not.toHaveProperty("eventPayload");
expect(regular).toHaveLength(0);
expect(sensitive).toHaveLength(metadata.length);
expect(JSON.stringify(sensitive)).toContain("private reason");
expect(JSON.stringify(sensitive)).toContain("owner@example.test");
```

次も追加する。

- 同じevent IDを通常・機微の両方へinsertしようとするとtriggerで拒否される。
- `payload_sensitivity = 'Regular'` のmetadataへ機微payloadをinsertすると拒否される。
- 未知のevent nameを `classifyPayloadSensitivity` へ渡すと `Sensitive` になる。
- migration前の全 `aggregate_state` / `event_payload` がmigration後の機微テーブルへ同数・同値で移る。
- 通常イベント一覧propsには機微payloadが含まれない。

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/adaptor/sqliteEventStore.test.ts test/integration/fileSqliteSmoke.test.ts test/web/securityBoundary.test.ts test/web/operatorConsolePages.test.tsx`

Expected: 新テーブルと `payloadSensitivity` が未定義でFAIL。

- [ ] **Step 3: schemaとmigrationを実装する**

```typescript
export const domainEventsTable = sqliteTable("domain_events", {
  eventId: text("event_id").primaryKey(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateName: text("aggregate_name").notNull(),
  eventName: text("event_name").notNull(),
  occurredAt: text("occurred_at").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  payloadSensitivity: text("payload_sensitivity", {
    enum: ["Regular", "Sensitive"],
  }).notNull(),
});

export const domainEventPayloadsTable = sqliteTable("domain_event_payloads", {
  eventId: text("event_id").primaryKey().references(() => domainEventsTable.eventId),
  aggregateState: text("aggregate_state", { mode: "json" }),
  eventPayload: text("event_payload", { mode: "json" }).notNull(),
});

export const domainEventSensitivePayloadsTable = sqliteTable(
  "domain_event_sensitive_payloads",
  {
    eventId: text("event_id").primaryKey().references(() => domainEventsTable.eventId),
    aggregateState: text("aggregate_state", { mode: "json" }),
    eventPayload: text("event_payload", { mode: "json" }).notNull(),
  },
);
```

`0004_audit_payload_split.sql` は旧payloadを一時テーブルへ退避し、`domain_events` を索引列だけで再作成し、全行へ `Sensitive` を設定してから機微テーブルへ旧JSONをコピーする。通常・機微payload insert時にmetadataの分類と一致するかを検証するtriggerを作る。metadata、対応payload、projectionの各書込みは各storeの一transaction内に残す。

- [ ] **Step 4: 中央serializerとwriterを実装する**

`Sensitive` へ非列挙のunique symbol markerと `Sensitive.is(value)` を追加する。`eventRecord.ts` へ `Sensitive`、配列、plain objectを再帰的に処理する `toAuditJsonValue` を置く。duck typingで任意の `unwrap` を呼ばず、`Sensitive.is` がtrueの値だけをunwrapして再帰処理する。関数やsymbolは拒否する。保存対象は `event.aggregateState` と `event.eventPayload` 全体であり、呼び出し側が安全版のstate/payloadを渡す引数を削除する。

```typescript
export const classifyPayloadSensitivity = (
  eventName: string,
): PayloadSensitivity =>
  regularEventNames.has(eventName) ? "Regular" : "Sensitive";

export const persistDomainEvent = (
  tx: SqliteTransaction,
  event: AnyDomainEvent,
): void => {
  const record = toEventRecord(event);
  tx.insert(domainEventsTable).values(record.metadata).run();
  const payload = {
    eventId: record.metadata.eventId,
    aggregateState: record.aggregateState,
    eventPayload: record.eventPayload,
  };
  if (record.metadata.payloadSensitivity === "Regular") {
    tx.insert(domainEventPayloadsTable).values(payload).run();
    return;
  }
  tx.insert(domainEventSensitivePayloadsTable).values(payload).run();
};
```

全event storeの `tx.insert(domainEventsTable).values(toEventRecord(...))` を `persistDomainEvent(tx, event)` へ置換し、`safeState` / `safePayload` を削除する。`persistedEventRow.ts` はevent名の閉じたunionではなく、metadataと選択したpayload rowの汎用Zod schemaを検証し、未知イベントも一覧化できるようにする。

- [ ] **Step 5: 一覧をsummary-onlyへ変更する**

`EventHistoryReader.list(admin)` は通常payloadだけjoinして `regularPayload` へ含め、機微payloadテーブルをjoinしない。`Events/Index.tsx` は機微行に「機微情報を含みます」、通常行にだけフィールド一覧を表示する。既知イベント名は `eventPresentation.ts` で日本語化し、未知名は「機微イベント」とevent IDだけを表示する。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/adaptor/sqliteEventStore.test.ts test/integration/fileSqliteSmoke.test.ts test/web/securityBoundary.test.ts test/web/operatorConsolePages.test.tsx`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。機微値は機微テーブルでは検出でき、metadata、通常テーブル、通常一覧propsでは検出できない。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/drizzle examples/final/test
git commit -m "feat(final): 監査ペイロードを機微情報ごとに分離"
git push
```

---

### Task 3: 予約集約とprojectionをversion付きの共通モデルへ移行する

**Files:**

- Modify: `examples/final/src/domain/appointment/appointment.ts`
- Modify: `examples/final/src/domain/appointment/appointmentEvent.ts`
- Modify: `examples/final/src/domain/appointment/appointmentStores.ts`
- Modify: `examples/final/src/domain/appointment/appointmentResolver.ts`
- Modify: `examples/final/src/useCase/bookAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/checkInAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/startExaminationUseCase.ts`
- Modify: `examples/final/src/useCase/recordExamResultUseCase.ts`
- Modify: `examples/final/src/useCase/recordPaymentUseCase.ts`
- Modify: `examples/final/src/useCase/cancelAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/listAppointmentsUseCase.ts`
- Modify: `examples/final/src/useCase/getAppointmentUseCase.ts`
- Modify: `examples/final/src/domain/followUp/followUpCandidate.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/schema.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/resolver/followUpResolver.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/examinationCompletionStore.ts`
- Create: `examples/final/drizzle/0005_appointment_operations.sql`
- Modify: `examples/final/drizzle/meta/_journal.json`
- Modify: `examples/final/test/domain/appointment.test.ts`
- Modify: `examples/final/test/useCase/appointmentUseCases.test.ts`
- Modify: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Modify: `examples/final/test/adaptor/sqliteResolver.test.ts`
- Modify: `examples/final/test/integration/fileSqliteSmoke.test.ts`

**State contract:**

```typescript
type AppointmentBase = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  durationMinutes: AppointmentDuration;
  serviceCode: ServiceCode;
  bookingKind: BookingKind;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
  receptionNote: ReceptionNote | null;
  settlement: NoPayment | DepositReceived;
  version: AppointmentVersion;
}>;
```

`Scheduled` と `CheckedIn` はnullableな `assignedVeterinarianId` を許可する。`InExamination`、`AwaitingPayment`、`Paid` は `assignedVeterinarianId: VeterinarianId` に絞る。`Paid.settlement` は `Settled`、`Canceled.settlement` は `NoPayment | DepositRefunded` に絞る。キャンセル後も `visitReason` を保持し、キャンセル理由は別の `cancellationReason` として持つ。既存 `Paid.amount` / `paidAt` は重複させず、`settlement.finalAmount` / `settledAt` へ移す。

- [ ] **Step 1: 新しい状態形状、version increment、既存migrationのRED testsを追加する**

```typescript
expect(booked.aggregateState).toMatchObject({
  kind: "Scheduled",
  serviceCode: "GeneralConsultation",
  durationMinutes: 30,
  bookingKind: "Reserved",
  assignedVeterinarianId: null,
  receptionNote: null,
  settlement: { kind: "NoPayment" },
  version: 1,
});
expect(checkedIn.aggregateState.version).toBe(2);
expect(started.aggregateState.version).toBe(3);
expect(completed.aggregateState.version).toBe(4);
expect(paid.aggregateState).toMatchObject({
  version: 5,
  settlement: {
    kind: "Settled",
    depositAmount: 0,
    additionalPaymentAmount: 4800,
    refundAmount: 0,
  },
});
```

file migration testには、旧 `Paid` が一般診療30分・予約・version 1・前受0円の `Settled` へ変換されるassertionを追加する。旧 `Canceled` のprojectionには元の来院理由が残っていないため復元を捏造せず、`visitReason` は固定値「移行前データ（来院理由不明）」、旧 `reason` は `cancellationReason` として保持し、settlementを `NoPayment` にする。

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts test/integration/fileSqliteSmoke.test.ts`

Expected: 新しいstate field、version列、migrationがないためFAIL。

- [ ] **Step 3: 集約stateと既存遷移を更新する**

このTaskでは既存画面を動かしたままにするため、`BookAppointmentUseCase` は新しい任意入力が未指定なら一般診療30分・予約・担当医未定・受付メモなしを補う。Task 4でHTTP入力を必須選択へ切り替える。すべての遷移は次のversionをevent stateへ含める。

```typescript
const nextVersion = (version: AppointmentVersion): AppointmentVersion =>
  AppointmentVersion.schema.parse(version + 1);

const checkIn =
  (context: EventContext) =>
  (scheduled: Scheduled): AppointmentCheckedIn => {
    const aggregateState = {
      ...scheduled,
      kind: "CheckedIn",
      checkedInAt: context.occurredAt,
      version: nextVersion(scheduled.version),
    } as const satisfies CheckedIn;
    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentCheckedIn",
      "appointment.checked-in",
      {
      appointmentId: scheduled.appointmentId,
      },
    );
  };
```

既存の診察開始は、Task 5で担当医ルールを完成させるまで、引数で受けた獣医師を `assignedVeterinarianId` に確定する。既存会計は `Settlement.settle(currentSettlement, amount, occurredAt)` を使う。キャンセルは `visitReason` と共通項目を保持する。

- [ ] **Step 4: projection schemaとmigrationを実装する**

`appointments` に次を追加する。

```text
scheduled_at TEXT NOT NULL
duration_minutes INTEGER NOT NULL
service_code TEXT NOT NULL
booking_kind TEXT NOT NULL
assigned_veterinarian_id TEXT NULL
reception_note TEXT NULL
settlement_status TEXT NOT NULL
deposit_amount INTEGER NULL
version INTEGER NOT NULL
```

`0005_appointment_operations.sql` は旧JSON stateを `json_set` で補完する。既存 `InExamination` / `AwaitingPayment` / `Paid` の獣医師IDを `assigned_veterinarian_id` へ引き継ぎ、`Paid` は既存amountを最終額・追加支払額として `Settled` へ変換する。projection列、JSON state、監査イベントは一transactionで更新する。

`parseAppointmentRow` は列とJSONの `appointmentId`、status、ownerId、petId、scheduledAt、duration、service、booking kind、assigned veterinarian、settlement status、deposit、versionを照合し、不一致を `Corrupt appointment projection` としてrepository errorへ閉じ込める。

- [ ] **Step 5: version付き条件更新を全既存storeへ適用する**

```typescript
const previousVersion = AppointmentVersion.schema.parse(state.version - 1);
const changes = tx.update(appointmentsTable)
  .set(toAppointmentValues(state))
  .where(and(
    eq(appointmentsTable.appointmentId, state.appointmentId),
    eq(appointmentsTable.status, expectedStatus),
    eq(appointmentsTable.version, previousVersion),
  ))
  .run().changes;
```

`ExaminationCompletionStore` も `InExamination` とversionの両方を条件にする。`changes !== 1` は `StaleAppointmentVersion` として返し、eventや診察結果projectionを一件も残さない。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/adaptor/sqliteEventStore.test.ts test/adaptor/sqliteResolver.test.ts test/integration/fileSqliteSmoke.test.ts test/useCase/followUpUseCases.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/drizzle examples/final/test
git commit -m "feat(final): 予約状態をversion付きprojectionへ移行"
git push
```

---

### Task 4: 予約登録・変更・再割当・飛び込みを一つのスケジュール不変条件へ接続する

**Files:**

- Modify: `examples/final/src/domain/appointment/appointment.ts`
- Modify: `examples/final/src/domain/appointment/appointmentEvent.ts`
- Modify: `examples/final/src/domain/appointment/appointmentStores.ts`
- Create: `examples/final/src/useCase/updateAppointmentUseCase.ts`
- Create: `examples/final/src/useCase/registerWalkInUseCase.ts`
- Create: `examples/final/src/useCase/reassignAppointmentVeterinarianUseCase.ts`
- Create: `examples/final/src/useCase/listVeterinariansUseCase.ts`
- Modify: `examples/final/src/useCase/bookAppointmentUseCase.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/db.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/receptionRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/components/AppointmentForm.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/New.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Appointments/Edit.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Reception/WalkIn.tsx`
- Modify: `examples/final/src/app.ts`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/domain/appointment.test.ts`
- Modify: `examples/final/test/useCase/appointmentUseCases.test.ts`
- Modify: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Modify: `examples/final/test/web/clinicFlow.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`

**Command contracts:**

```typescript
type UpdateAppointmentInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  ownerId: OwnerId;
  petId: PetId;
  scheduledAt: Timestamp;
  durationMinutes: AppointmentDuration;
  serviceCode: ServiceCode;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
}>;

type RegisterWalkInInput = Readonly<{
  actorUserId: UserId;
  ownerId: OwnerId;
  petId: PetId;
  durationMinutes: AppointmentDuration;
  serviceCode: ServiceCode;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
  receptionNote: ReceptionNote | null;
}>;

type ReassignAppointmentVeterinarianInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  assignedVeterinarianId: VeterinarianId | null;
}>;
```

Store errorは用途を分ける。

```typescript
type AppointmentStoreError =
  | RepositoryError
  | Readonly<{
      kind: "StaleAppointmentVersion";
      appointmentId: AppointmentId;
      expectedVersion: AppointmentVersion;
    }>
  | Readonly<{
      kind: "VeterinarianScheduleConflict";
      appointmentId: AppointmentId;
      conflictingAppointmentId: AppointmentId;
    }>;
```

- [ ] **Step 1: 予約変更条件、飛び込み、担当医重複のRED testsを追加する**

次のケースをdomain/use case/SQLiteの各適切な層へ追加する。

- `Scheduled` だけを変更でき、`CheckedIn` は `InvalidAppointmentState` になる。
- 前受済みではpetとserviceを変更できないが、日時・担当医・所要時間・来院理由は変更できる。
- 飛び込みはserver clockを `scheduledAt` と `checkedInAt` に使い、`WalkIn` / `CheckedIn` / version 1になる。
- 10:00–10:30と10:29–10:44は同じ獣医師なら拒否し、10:30開始は許可する。
- 既存または候補が担当医未定なら許可する。
- `InExamination`、`AwaitingPayment`、`Paid`、`Canceled` は重複判定の既存側から除外する。
- 予約変更では自分自身を除外する。
- 二つのSQLite接続から同じ獣医師・時間帯へ並行登録しても一件だけ成功する。

```typescript
const [first, second] = await Promise.all([
  firstStore.store(firstBooked),
  secondStore.store(secondBooked),
]);
expect([first, second].filter((result) => result.isOk())).toHaveLength(1);
expect(
  [first, second].find((result) => result.isErr())?._unsafeUnwrapErr(),
).toMatchObject({ kind: "VeterinarianScheduleConflict" });
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/adaptor/sqliteEventStore.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx`

Expected: 新遷移、use case、route、form、重複判定がなくFAIL。

- [ ] **Step 3: domain eventとcommand use caseを実装する**

追加するeventは次とする。

```text
appointment.updated
appointment.walk-in-registered
appointment.veterinarian-reassigned
```

`Appointment.update` は `Scheduled` だけを受け、versionを1増やす。`Appointment.registerWalkIn` は初期状態を直接 `CheckedIn` とし、予約時刻と受付時刻に同じserver timestampを使う。`Appointment.reassignVeterinarian` は `Scheduled | CheckedIn` を受ける。

各use caseは actor、owner/pet整合、veterinarianの存在とrole、状態、`expectedVersion` をstore呼出し前に検証する。前受済み編集でpetまたはserviceが変わる場合は `PrepaidAppointmentImmutableFieldsChanged` を返す。`ListVeterinariansUseCase` は全ロールが獣医師のIDと表示名だけを取得できる専用queryとし、管理者専用 `ListUsersUseCase` を受付画面へ流用しない。

- [ ] **Step 4: SQLite重複判定を即時transactionへ実装する**

候補に担当医があるイベントだけ、projection更新前に次の条件で一件取得する。

```typescript
const conflict = tx.select({ appointmentId: appointmentsTable.appointmentId })
  .from(appointmentsTable)
  .where(and(
    eq(appointmentsTable.assignedVeterinarianId, candidate.veterinarianId),
    inArray(appointmentsTable.status, ["Scheduled", "CheckedIn"]),
    ne(appointmentsTable.appointmentId, candidate.appointmentId),
    sql`julianday(${appointmentsTable.scheduledAt}) < julianday(${candidate.endsAt})`,
    sql`julianday(${candidate.startsAt}) < julianday(
      ${appointmentsTable.scheduledAt},
      '+' || ${appointmentsTable.durationMinutes} || ' minutes'
    )`,
  ))
  .limit(1)
  .get();
```

予約作成、変更、再割当、飛び込みを `db.transaction(..., { behavior: "immediate" })` で囲む。`createSqliteDatabase` はfile DBの別接続が先行transactionの完了を待てるよう `busy_timeout = 5000` を設定する。待機後に同じ重複queryを評価するため、二番目の処理は汎用 `SQLITE_BUSY` ではなくtypedな競合として返る。競合があればprojection・eventを一件も書かず、競合相手のappointment IDをtyped errorへ入れる。本文やペット名はerrorへ入れない。

- [ ] **Step 5: shared formとHTTP routeを実装する**

`AppointmentForm.tsx` は新規・変更の共通部品とし、飼い主、ペット、予約日時、診療メニュー、所要時間、担当獣医師、来院理由をこの順に表示する。診療メニュー変更時は、利用者がまだ所要時間を手動変更していない場合だけ既定値を提案する。

```typescript
const AppointmentInputSchema = z.object({
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  scheduledAt: Timestamp.schema,
  serviceCode: ServiceCode.schema,
  durationMinutes: z.coerce.number().pipe(AppointmentDuration.schema),
  assignedVeterinarianId: z.preprocess(
    (value) => value === "" ? null : value,
    VeterinarianId.schema.nullable(),
  ),
  reason: AppointmentReason.schema,
});
```

追加・変更するrouteは次とする。

```text
GET  /appointments/new
POST /appointments
GET  /appointments/:appointmentId/edit
PUT  /appointments/:appointmentId
POST /appointments/:appointmentId/veterinarian
GET  /reception/walk-ins/new
POST /reception/walk-ins
```

routeは `StaleAppointmentVersion`、`VeterinarianScheduleConflict`、変更不可状態、前受後の禁止変更をallowlistされた日本語field/form errorへ写像する。自由記述をquery stringへ入れない。成功時は303で予約詳細へ移動する。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/adaptor/sqliteEventStore.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。既知の303/302 baseline失敗も、このroute契約のassertionで解消している。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 重複を防ぐ予約変更と飛び込み受付を追加"
git push
```

---

### Task 5: 担当医規則・受付メモ・前受金・最終精算を予約詳細へ接続する

**Files:**

- Modify: `examples/final/src/domain/appointment/appointment.ts`
- Modify: `examples/final/src/domain/appointment/appointmentEvent.ts`
- Modify: `examples/final/src/domain/appointment/appointmentStores.ts`
- Create: `examples/final/src/useCase/updateReceptionNoteUseCase.ts`
- Create: `examples/final/src/useCase/receiveAppointmentDepositUseCase.ts`
- Modify: `examples/final/src/useCase/checkInAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/startExaminationUseCase.ts`
- Modify: `examples/final/src/useCase/recordExamResultUseCase.ts`
- Modify: `examples/final/src/useCase/recordPaymentUseCase.ts`
- Modify: `examples/final/src/useCase/cancelAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/getAppointmentUseCase.ts`
- Modify: `examples/final/src/useCase/listAppointmentsUseCase.ts`
- Modify: `examples/final/src/useCase/errors.ts`
- Modify: `examples/final/src/useCase/authorization.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/examinationCompletionStore.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/appointmentPresentation.ts`
- Modify: `examples/final/src/app.ts`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/domain/appointment.test.ts`
- Modify: `examples/final/test/useCase/appointmentUseCases.test.ts`
- Modify: `examples/final/test/useCase/startExaminationUseCase.test.ts`
- Modify: `examples/final/test/adaptor/sqliteEventStore.test.ts`
- Modify: `examples/final/test/web/clinicFlow.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Added events:**

```text
appointment.reception-note-updated
appointment.deposit-received
appointment.final-settlement-recorded
```

`appointment.canceled` はevent payloadへ `refundAmount` を含め、前受済みならaggregate stateを `DepositRefunded` にする。

- [ ] **Step 1: 認可、version、前受・精算・返金のRED testsを追加する**

次を検証する。

- 管理者・受付だけが受付メモを更新でき、獣医師は本文を閲覧できるが更新できない。
- `Paid` / `Canceled` の受付メモは更新できない。
- 担当医ありの予約は、その獣医師または管理者だけが診察開始できる。
- 担当医未定を獣医師が開始すると、その獣医師を担当医として確定する。
- 担当医未定を管理者が開始するときは獣医師選択が必須である。
- 担当医未定の確定でも既存 `Scheduled` / `CheckedIn` と重複すれば拒否する。
- 予防接種の `Scheduled` / `CheckedIn` だけ前受でき、二回目を拒否する。
- 最終額が前受額より多い、同じ、少ない三ケースの内訳が正しい。
- 前受済みキャンセルは `DepositRefunded` となり、refund amountが全額である。
- event insertを故意に失敗させると前受、精算、返金、キャンセルのprojectionもrollbackする。
- すべてのPOSTが古い `expectedVersion` を拒否し、最新状態を上書きしない。

```typescript
expect(
  Appointment.settle(settlementContext)(awaitingPayment, finalAmount)
    .aggregateState.settlement,
).toEqual({
  kind: "Settled",
  finalAmount,
  depositAmount: adjustment(7000),
  additionalPaymentAmount: adjustment(0),
  refundAmount: adjustment(2000),
  settledAt: settlementContext.occurredAt,
});
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/useCase/startExaminationUseCase.test.ts test/adaptor/sqliteEventStore.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: 新しいrule、event、use case、detail actionがなくFAIL。

- [ ] **Step 3: 純粋遷移とuse caseを実装する**

`Appointment.receiveDeposit` は `Result<DepositReceivedEvent, DepositRuleError>` を返し、診療メニュー、状態、現在の支払状態を検証する。`Appointment.settle` は `AwaitingPayment` と正の最終額から差額を再計算する。`Appointment.cancel` は現在のsettlementに応じて `NoPayment` または `DepositRefunded` を作る。

`StartExaminationUseCase` の担当医決定は次の純粋関数に集約する。

```typescript
const selectVeterinarian = (
  actor: Admin | Veterinarian,
  appointment: CheckedIn,
  requested: VeterinarianId | undefined,
): Result<VeterinarianId, UnauthorizedError | VeterinarianRequired> => {
  if (appointment.assignedVeterinarianId !== null) {
    return actor.kind === "Admin" ||
      actor.veterinarianId === appointment.assignedVeterinarianId
      ? ok(appointment.assignedVeterinarianId)
      : err({ kind: "Unauthorized", actorUserId: actor.userId });
  }
  if (actor.kind === "Veterinarian") return ok(actor.veterinarianId);
  return requested === undefined
    ? err({ kind: "VeterinarianRequired" })
    : ok(requested);
};
```

全mutation inputへ `expectedVersion` を追加し、resolved stateとの不一致ではclock、ID generator、storeを呼ばない。storeの競合も同じ `StaleAppointmentVersion` へ正規化する。

- [ ] **Step 4: detail DTO、action、formを実装する**

予約詳細のDTOへ、診療メニュー、予約種別、終了時刻、担当医、受付メモ、支払状態、versionを追加する。`AppointmentActions` は次をserverで確定する。

```typescript
type AppointmentActions = Readonly<{
  edit: boolean;
  checkIn: boolean;
  reassignVeterinarian: boolean;
  updateReceptionNote: boolean;
  receiveDeposit: boolean;
  startExamination: boolean;
  recordExamResult: boolean;
  settle: boolean;
  cancel: boolean;
}>;
```

追加・変更するPOSTは次とする。

```text
POST /appointments/:appointmentId/reception-note
POST /appointments/:appointmentId/deposit
POST /appointments/:appointmentId/check-in
POST /appointments/:appointmentId/start-examination
POST /appointments/:appointmentId/exam-results
POST /appointments/:appointmentId/payment
POST /appointments/:appointmentId/cancel
```

すべてhiddenの `expectedVersion` を受ける。前受フォームは予防接種の対象状態だけ、最終精算フォームは `AwaitingPayment` だけに表示する。既存の診断・処置入力は維持し、`diagnosis`、`treatment`、`finalAmount` を送る。クライアントpreviewは最終額入力と現在の前受額から追加支払・返金を表示するが、計算済みの差額は送らず、サーバーで再計算する。

前受済みキャンセルのボタンと確認文は「前受金を全額返金してキャンセル」に変える。機微値をquery errorへ入れない。

- [ ] **Step 5: SQLite transactionと監査保存を完成させる**

担当医未定からの診察開始では、Task 4と同じ重複queryを `BEGIN IMMEDIATE` 内で実行してから `CheckedIn → InExamination` を更新する。受付メモ、前受、最終精算、キャンセルはversion付き条件更新、projection列、JSON state、機微監査payloadを同じtransactionに置く。

機微テーブルの保存内容に来院理由、受付メモ、settlement内訳、診断、処置が含まれることをassertし、通常payloadテーブルとイベント一覧propsに含まれないことを併せてassertする。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/useCase/startExaminationUseCase.test.ts test/adaptor/sqliteEventStore.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 前受金と差額精算を予約詳細へ追加"
git push
```

---

### Task 6: 日・週予約カレンダーのread modelと画面を追加する

**Files:**

- Create: `examples/final/src/domain/appointment/businessDate.ts`
- Create: `examples/final/src/useCase/query/appointmentCalendarReader.ts`
- Create: `examples/final/src/useCase/listAppointmentCalendarUseCase.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/query/appointmentCalendarReader.ts`
- Create: `examples/final/src/adaptor/primary/web/routes/appointmentCalendarRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/components/CalendarToolbar.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/AppointmentCalendar.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/servicePresentation.ts`
- Create: `examples/final/src/adaptor/primary/web/components/settlementPresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/components/AppShell.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/Icon.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/src/app.ts`
- Create: `examples/final/test/useCase/appointmentCalendarUseCase.test.ts`
- Create: `examples/final/test/adaptor/appointmentCalendarReader.test.ts`
- Create: `examples/final/test/web/appointmentCalendarRoutes.test.ts`
- Create: `examples/final/test/web/appointmentCalendarPage.test.tsx`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`

**Read contract:**

```typescript
type AppointmentCalendarItem = Readonly<{
  appointmentId: AppointmentId;
  startsAt: Timestamp;
  endsAt: Timestamp;
  durationMinutes: AppointmentDuration;
  petName: string;
  serviceCode: ServiceCode;
  assignedVeterinarianId: VeterinarianId | null;
  assignedVeterinarianName: string | null;
  appointmentStatus: Appointment["kind"];
  settlementStatus: SettlementState["kind"];
}>;

type AppointmentCalendarReader = Readonly<{
  list: (
    actor: User,
    range: Readonly<{ startsAt: Timestamp; endsAt: Timestamp }>,
  ) => ResultAsync<readonly AppointmentCalendarItem[], RepositoryError>;
}>;
```

- [ ] **Step 1: JST境界、query validation、表示順のRED testsを追加する**

次を検証する。

- `2026-08-09` は `2026-08-08T15:00:00.000Z` から翌日同時刻までを日範囲にする。
- 週は月曜始まり・翌月曜終わりとする。
- 日表示は担当医未定、獣医師名順の列になる。
- 週表示は日付列だけで、カード内に担当医名を持つ。
- 同じ開始時刻はペット名順になる。
- 08:00前と20:00以降は補助一覧へ入る。
- キャンセルは既定非表示で、切替時だけ表示する。
- 不正な `date` はJST当日、不正な `view` はautoへ戻る。
- routeは自由記述、飼い主名、受付メモをcalendar DTOへ含めない。

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/appointmentCalendarUseCase.test.ts test/adaptor/appointmentCalendarReader.test.ts test/web/appointmentCalendarRoutes.test.ts test/web/appointmentCalendarPage.test.tsx test/web/operatorConsolePages.test.tsx`

Expected: reader、use case、route、calendar componentがなくFAIL。

- [ ] **Step 3: BusinessDateとSQLite readerを実装する**

`BusinessDate.schema` は実在する `YYYY-MM-DD` だけを受ける。JST範囲は `new Date(`${date}T00:00:00+09:00`)` からISO timestampへ変換し、曜日計算はUTCの正午を基準にして日付ずれを避ける。

SQLite readerは `scheduled_at >= startsAt AND scheduled_at < endsAt` でappointmentsを絞り、petsとusersをjoinする。画面に必要な列だけselectし、各列と組み立てたDTOをZodで検証する。来院理由、受付メモ、owner情報はselectしない。

- [ ] **Step 4: routeとURL stateを実装する**

`GET /appointments?date=2026-08-09&view=week&canceled=1` を `appointmentCalendarRoutes.ts` が所有し、従来の一覧GETを `appointmentRoutes.ts` から削除する。serverは基準日を含む週データを返し、`view` 未指定または不正時はpropsを `requestedView: null` とする。

クライアントは初回mount時だけ `matchMedia("(max-width: 767px)")` を使い、`requestedView === null` ならmobileを日、その他を週として `router.replace` でURLを正規化する。以後の今日・前・次・日/週切替は常に `date` と `view` をURLへ保存する。

- [ ] **Step 5: calendar componentとCSSを実装する**

`AppointmentCalendar` は日表示で縦時間軸×担当医列、週表示で縦時間軸×日付列を描く。08:00〜20:00を15分単位のCSS gridにし、カードのtop/heightは時刻とdurationから算出する。position style以外へ業務状態を埋め込まない。

各カードは次のaccessible nameを持つ。

```tsx
<Link
  aria-label={`${timeRange}、${petName}、${serviceLabel}、${vetLabel}、${statusLabel}、${settlementLabel}`}
  href={`/appointments/${appointmentId}`}
>
  {/* visible Japanese labels */}
</Link>
```

08:00前・20:00以降は上部/下部のnative listへ表示する。1024pxではcalendar領域だけ横スクロールを許し、768px未満は日表示にする。ページ全体へ横overflowを出さない。

AppShellの予約項目は「予約カレンダー」へ改名する。このTaskでは受付ボード項目はまだ追加しない。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/appointmentCalendarUseCase.test.ts test/adaptor/appointmentCalendarReader.test.ts test/web/appointmentCalendarRoutes.test.ts test/web/appointmentCalendarPage.test.tsx test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 日週切替の予約カレンダーを追加"
git push
```

---

### Task 7: 縦型受付ボードと安全な30秒更新を追加する

**Files:**

- Create: `examples/final/src/useCase/query/receptionBoardReader.ts`
- Create: `examples/final/src/useCase/getReceptionBoardUseCase.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/query/receptionBoardReader.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/receptionRoutes.ts`
- Create: `examples/final/src/adaptor/primary/web/receptionPolling.ts`
- Create: `examples/final/src/adaptor/primary/web/components/ReceptionSection.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/ReceptionRow.tsx`
- Create: `examples/final/src/adaptor/primary/web/pages/Reception/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/AppShell.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/Icon.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/src/app.ts`
- Create: `examples/final/test/useCase/receptionBoardUseCase.test.ts`
- Create: `examples/final/test/adaptor/receptionBoardReader.test.ts`
- Create: `examples/final/test/web/receptionRoutes.test.ts`
- Create: `examples/final/test/web/receptionBoardPage.test.tsx`
- Create: `examples/final/test/web/receptionPolling.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Read contract:**

```typescript
type ReceptionPrimaryAction =
  | "CheckIn"
  | "StartExamination"
  | "OpenDetails"
  | "Settle";

type ReceptionBoardRow = Readonly<{
  appointmentId: AppointmentId;
  version: AppointmentVersion;
  bookingKind: BookingKind;
  scheduledAt: Timestamp;
  checkedInAt: Timestamp | null;
  waitingMinutes: number | null;
  ownerName: string;
  petName: string;
  serviceCode: ServiceCode;
  assignedVeterinarianName: string | null;
  receptionNote: string | null;
  appointmentStatus: Appointment["kind"];
  settlementStatus: SettlementState["kind"];
  primaryAction: ReceptionPrimaryAction;
}>;

type ReceptionBoard = Readonly<{
  businessDate: BusinessDate;
  loadedAt: Timestamp;
  scheduled: readonly ReceptionBoardRow[];
  checkedIn: readonly ReceptionBoardRow[];
  inExamination: readonly ReceptionBoardRow[];
  awaitingPayment: readonly ReceptionBoardRow[];
  paid: readonly ReceptionBoardRow[];
  canceled: readonly ReceptionBoardRow[];
}>;
```

- [ ] **Step 1: 状態分類、並び順、role action、pollingのRED testsを追加する**

query/use case testsへ次を追加する。

- JST当日に開始する予約だけを取得する。
- 未受付は予約時刻、診察待ちは受付時刻、診察中は開始時刻、会計待ちは完了時刻の昇順になる。
- 完了は精算時刻の降順になる。
- 受付メモを許可済みDTOへだけunwrapする。
- 受付は受付・会計、獣医師は担当予約の診察開始、管理者は必要な全actionだけを受ける。
- 件数は各配列長と一致する。

polling controller testsへ次を追加する。

```typescript
const stop = startReceptionPolling(fakeEnvironment);
clock.advanceBy(30_000);
expect(reload).toHaveBeenCalledTimes(1);

visibility.set("hidden");
clock.advanceBy(60_000);
expect(reload).toHaveBeenCalledTimes(1);

visibility.set("visible");
expect(reload).toHaveBeenCalledTimes(2);

formBusy.set(true);
clock.advanceBy(30_000);
expect(reload).toHaveBeenCalledTimes(2);
stop();
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/receptionBoardUseCase.test.ts test/adaptor/receptionBoardReader.test.ts test/web/receptionRoutes.test.ts test/web/receptionBoardPage.test.tsx test/web/receptionPolling.test.ts test/web/operatorConsolePages.test.tsx`

Expected: reader、use case、page、polling controllerがなくFAIL。

- [ ] **Step 3: SQLite readerとrole-aware use caseを実装する**

readerはTask 6と同じJST日範囲でappointmentsを絞り、owner、pet、assigned veterinarianをjoinする。待ち時間は `loadedAt - checkedInAt` を0以上の分へ丸める。予約状態ごとの時刻が欠ける行はZodで拒否し、壊れたprojectionを画面へ出さない。

`GetReceptionBoardUseCase` はactorを解決し、readerへ明示的な `User` capabilityを渡す。`primaryAction` はserver側で一つだけ決める。操作不能または主要操作が詳細内にある場合は `OpenDetails` とする。

- [ ] **Step 4: 縦型section UIを実装する**

`GET /reception` は `Reception/Index` を描画する。表示順は「未受付」「診察待ち」「診察中」「会計待ち」「完了」「キャンセル」とする。完了・キャンセルは初期折りたたみ、他は初期展開し、各見出しへ件数を出す。

```tsx
<section aria-labelledby={`reception-${section.key}`}>
  <button aria-expanded={expanded} type="button">
    <span id={`reception-${section.key}`}>{section.label}</span>
    <span>{section.rows.length}件</span>
  </button>
  {expanded ? <ReceptionRows rows={section.rows} /> : null}
</section>
```

デスクトップでは一患者一行、768px未満では同じ情報順のカードにする。各行へ予約時刻または「飛び込み」、受付時刻と待ち時間、ペット・飼い主、診療メニュー、担当医、受付メモ、診療状態、支払状態、主要actionを表示する。drag-and-dropを追加しない。

quick actionはserver-projected `primaryAction` だけを描画し、POSTにはそのrowの `expectedVersion` を含める。会計は金額入力を置かず予約詳細へ移動する。

- [ ] **Step 5: 30秒更新を実装する**

`receptionPolling.ts` はtimer、visibility、form busy、reloadを注入可能なcontrollerとする。React pageは `useEffect` でcontrollerを開始・破棄し、reloadを次のInertia partial reloadへ接続する。

```typescript
router.reload({
  only: ["board"],
  preserveScroll: true,
  preserveState: true,
  onFinish: () => setSubmitting(false),
});
```

タブ非表示時とform処理中はtimer reloadを行わない。visibleへ戻ったときは即時reloadする。手動「更新」と `board.loadedAt` の最終更新時刻を表示し、その時刻だけを控えめな `aria-live="polite"` にする。section展開stateと入力中form stateはpartial reloadで維持する。

- [ ] **Step 6: navigationとresponsive CSSを実装する**

AppShellへ `reception` navigation keyと日本語ラベル「受付ボード」を追加する。全ロールへ表示し、予約カレンダーとは別リンク `/reception` にする。サイドバー順を仕様どおり次へ固定する。

```text
ダッシュボード
予約カレンダー
受付ボード
飼い主
ペット
フォローアップ
ユーザー
イベント履歴
```

- [ ] **Step 7: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/receptionBoardUseCase.test.ts test/adaptor/receptionBoardReader.test.ts test/web/receptionRoutes.test.ts test/web/receptionBoardPage.test.tsx test/web/receptionPolling.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 8: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 縦型の受付ボードを追加"
git push
```

---

### Task 8: 機微監査ペイロードを明示開示し、閲覧自体を監査する

**Files:**

- Create: `examples/final/src/domain/aggregate/auditEvent.ts`
- Create: `examples/final/src/useCase/query/sensitiveAuditPayloadDisclosure.ts`
- Create: `examples/final/src/useCase/revealSensitiveAuditPayloadUseCase.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/eventRecord.ts`
- Create: `examples/final/src/adaptor/secondary/sqlite/query/sensitiveAuditPayloadDisclosure.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/eventRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/eventPresentation.ts`
- Modify: `examples/final/src/app.ts`
- Create: `examples/final/test/useCase/revealSensitiveAuditPayloadUseCase.test.ts`
- Create: `examples/final/test/adaptor/sensitiveAuditPayloadDisclosure.test.ts`
- Modify: `examples/final/test/web/managementRoutes.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Disclosure contract:**

```typescript
type SensitiveAuditPayload = Readonly<{
  aggregateState: unknown | null;
  eventPayload: Readonly<Record<string, unknown>>;
}>;

type SensitiveAuditPayloadDisclosure = Readonly<{
  revealAndRecord: (
    targetEventId: EventId,
    viewedEvent: SensitiveAuditPayloadViewed,
  ) => ResultAsync<
    SensitiveAuditPayload,
    RepositoryError | AuditEventNotFound | AuditPayloadNotSensitive
  >;
}>;
```

`SensitiveAuditPayloadViewed` は次だけを持つ。

```typescript
{
  kind: "SensitiveAuditPayloadViewed",
  aggregateName: "Audit",
  aggregateId: targetEventId,
  eventName: "audit.sensitive-payload-viewed",
  aggregateState: undefined,
  eventPayload: {
    targetEventId,
    viewerUserId: actor.userId,
    viewedAt: context.occurredAt,
  },
}
```

- [ ] **Step 1: 開示認可・原子性・非複製のRED testsを追加する**

次を検証する。

- 管理者だけが機微payloadを開示できる。
- 通常payload、存在しないeventは開示しない。
- 開示成功時に `audit.sensitive-payload-viewed` が一件増える。
- 閲覧eventは `Regular` テーブルだけに入り、対象payload本文を複製しない。
- 閲覧event ID重複などで監査insertを失敗させると機微payloadを返さない。
- 通常一覧GETは開示前後とも機微payloadを含まない。
- HTTP responseとReact state以外にpayloadを保存せず、`localStorage` / `sessionStorage` を使わない。

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/revealSensitiveAuditPayloadUseCase.test.ts test/adaptor/sensitiveAuditPayloadDisclosure.test.ts test/web/managementRoutes.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: event、port、use case、endpoint、buttonがなくFAIL。

- [ ] **Step 3: domain eventとuse caseを実装する**

`eventRecord.ts` のregular allowlistへ既知の完全一致 `audit.sensitive-payload-viewed` だけを追加する。`RevealSensitiveAuditPayloadUseCase` はactorを解決して `Admin` に絞り、clockとevent ID generatorでviewed eventを作ってから、一度だけ `revealAndRecord` を呼ぶ。認可失敗時はclock、generator、disclosureを呼ばない。

- [ ] **Step 4: read+write transactionを実装する**

SQLite adaptorは一つのtransaction内で次を同期実行する。

1. metadataが `Sensitive` であることを確認する。
2. `domain_event_sensitive_payloads` から対象行を読む。
3. viewed eventのmetadataを `domain_events` へinsertする。
4. viewed eventのpayloadを `domain_event_payloads` へinsertする。
5. transaction callbackの戻り値として対象payloadを返す。

transaction commit前の値を外へ返さない。どのinsertが失敗してもPromiseをrejectし、`ResultAsync` はpayloadではなくtyped repository errorを返す。

- [ ] **Step 5: JSON開示endpointと一時表示UIを実装する**

```text
POST /events/:eventId/sensitive-payload
```

endpointはInertia history propsではなく、same-origin JSONとしてpayloadを返す。`Events/Index.tsx` は管理者の明示ボタンでfetchし、component-local stateへ対象event ID単位で保持する。開示中、閉じる、再開示を用意し、unmount時にstateを破棄する。値はnative `<dl>` / `<pre>` の安全なtext nodeとして表示し、`dangerouslySetInnerHTML` を使わない。

一覧の通常GET、URL、flash、error query、server log、閲覧event payloadへ開示値を渡さない。

- [ ] **Step 6: focused verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/useCase/revealSensitiveAuditPayloadUseCase.test.ts test/adaptor/sensitiveAuditPayloadDisclosure.test.ts test/web/managementRoutes.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts test/adaptor/sqliteEventStore.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

- [ ] **Step 7: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 機微監査情報の開示を監査"
git push
```

---

### Task 9: 日本語表示境界と業務フローを統合検証する

**Files:**

- Create: `examples/final/src/adaptor/primary/web/components/rolePresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/components/AppShell.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/appointmentPresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/components/servicePresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/components/settlementPresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/components/eventPresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Dashboard.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Reception/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Users/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Users/Form.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/middleware/useCaseResponse.ts`
- Create: `examples/final/test/integration/appointmentOperationsFlow.test.ts`
- Modify: `examples/final/test/web/clinicFlow.test.ts`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

- [ ] **Step 1: 日本語境界と全業務フローのRED testsを追加する**

SSR/route testsは通常画面のvisible textに次の内部コードが残らないことを確認する。

```typescript
for (const internalCode of [
  "Scheduled", "CheckedIn", "InExamination", "AwaitingPayment",
  "Paid", "Canceled", "Admin", "Receptionist", "Veterinarian",
  "GeneralConsultation", "FollowUpVisit", "Vaccination",
  "ExaminationOrProcedure", "Reserved", "WalkIn",
]) {
  expect(html).not.toContain(`>${internalCode}<`);
}
```

integration flowはreal Hono + file SQLiteで次を通す。

1. 受付が担当医あり予防接種を予約する。
2. 同じ担当医・重複時間の予約を拒否する。
3. 前受金を登録する。
4. 受付し、担当医が診察を開始する。
5. 診察結果を登録する。
6. 前受より少ない最終額を入力し、返金差額で精算する。
7. 別の前受済み予約を全額返金してキャンセルする。
8. 管理者が機微監査payloadを開示し、閲覧eventを確認する。
9. calendarとreceptionの両read modelが最新状態を返す。

別ケースで、二つの古いdetail propsから先に一方だけを更新し、後続POSTをversion競合で拒否する。

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/integration/appointmentOperationsFlow.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: raw role/status label、統合漏れ、error mappingの不足でFAIL。

- [ ] **Step 3: presentation mappingを一箇所へ集約する**

```typescript
export const rolePresentation = (role: User["kind"]): string => {
  switch (role) {
    case "Admin": return "管理者";
    case "Receptionist": return "受付";
    case "Veterinarian": return "獣医師";
    default: return assertNever(role);
  }
};
```

同様に予約状態、診療メニュー、予約種別、支払状態、event名をexhaustive switchで日本語化する。既存 `appointmentPresentation` の `canonical` 表示を削除する。formのoption labelは日本語、valueは内部コードのままにする。未知eventはevent nameをそのまま見せず「機微イベント」とevent IDを表示する。

- [ ] **Step 4: allowlisted error mappingを完成させる**

route/useCase errorを次の日本語へ統一する。

```text
VeterinarianScheduleConflict -> 選択した時間帯には、この獣医師の別の予約があります。
StaleAppointmentVersion -> 別の端末で予約が更新されました。最新の内容を確認してください。
InvalidAppointmentState(edit) -> 受付後の予約内容は変更できません。
DepositNotAllowed -> 事前会計は予防接種の予約だけで利用できます。
DepositAlreadyReceived -> この予約の前受金はすでに登録されています。
UnassignedOrDifferentVeterinarian -> この予約を診察開始できるのは、担当獣医師または管理者です。
SettlementConflict -> 会計情報が更新されています。金額を確認し直してください。
UnauthorizedDisclosure -> この監査情報を表示する権限がありません。
RepositoryError -> 処理を完了できませんでした。時間をおいて再度お試しください。
```

error DTO、query code、logには入力値を含めない。

- [ ] **Step 5: integrationとsecurity verificationをGREENにする**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/integration/appointmentOperationsFlow.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: packageの全testとtypecheckがPASS。

- [ ] **Step 6: checkpointをcommit/pushする**

```bash
git add examples/final/src examples/final/test
git commit -m "feat(final): 予約受付フローの日本語表示を統一"
git push
```

---

### Task 10: 公開説明、build、画面サイズ別の受け入れ確認を完了する

**Files:**

- Modify: `examples/final/README.md`
- Modify: `apps/docs/src/pages/sessions/final.astro`
- Modify: `apps/docs/src/test/pages/sessions/final.test.ts`
- Generated if changed: `examples/final/src/adaptor/primary/web/pages.gen.ts`

- [ ] **Step 1: 公開説明のRED testを追加する**

`final.test.ts` は次を要求する。

```typescript
expect(page).toContain("予約カレンダー");
expect(page).toContain("受付ボード");
expect(page).toContain("担当獣医師の重複");
expect(page).toContain("前受金");
expect(page).toContain("差額精算");
expect(page).toContain("domain_event_sensitive_payloads");
expect(page).toContain("機微情報の閲覧自体を監査");
expect(page).not.toContain("SanitizedAuditRecord");
expect(page).not.toContain("PII の非表示");
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/sessions/final.test.ts`

Expected: README/public pageが旧監査境界と旧予約一覧を説明しているためFAIL。

- [ ] **Step 3: READMEと公開セッションを現在実装へ同期する**

次を説明する。

- `/appointments` の日・週カレンダーと `/reception` の縦型受付ボード。
- 固定診療メニュー、担当医未定、半開区間の重複規則。
- `Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid` と別軸のsettlement state。
- 予防接種の前受金、追加支払・返金、前受済みキャンセル。
- version付き条件更新と `BEGIN IMMEDIATE` の責務差。
- `domain_events`、`domain_event_payloads`、`domain_event_sensitive_payloads` の境界。
- PIIを保存しない旧説明を削除し、機微テーブルへ全state/payloadを保存して明示開示を監査する現在契約へ置換する。
- SQLiteファイル自体は暗号化しない対象外事項。

公開コード例は実在する最終コードへ合わせ、古い `veterinarianId`、`PaymentRecorded`、`SanitizedAuditRecord` のsnippetを残さない。

- [ ] **Step 4: formatterと生成物を確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Viteが `pages.gen.ts` を更新した場合だけ差分をレビューしてstageする。生成ページ名に `Appointments/Edit`、`Reception/Index`、`Reception/WalkIn` が含まれることを確認する。

- [ ] **Step 5: packageとrootの自動検証を実行する**

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS。

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: PASS。

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Expected: PASS。

Run: `pnpm typecheck`

Expected: PASS。

Run: `pnpm test`

Expected: PASS。計画開始時の `clinicFlow.test.ts` 2失敗を含め、既知失敗を残さない。

Run: `pnpm build`

Expected: PASS。

- [ ] **Step 6: 手動受け入れ確認を行う**

開発serverを `0.0.0.0` で起動し、1440px、1024px、375pxで確認する。

```bash
pnpm --filter @fp-with-ts/clinic-final dev --host 0.0.0.0
mobile-preview-url 5173
```

確認項目:

- 予約カレンダーと受付ボードが別nav・別URLである。
- 日/週、今日/前/次、キャンセル切替がURLと同期する。
- 08:00〜20:00外の予約が補助一覧へ出る。
- 受付ボードが縦型で、完了・キャンセルだけ初期折りたたみになる。
- キーボードだけで日付移動、表示切替、予約カード、受付操作を実行できる。
- hidden tab、form処理中、visible復帰で30秒更新が仕様どおり停止・再開する。
- 二ブラウザーの古い予約詳細から更新し、片方だけが成功する。
- 前受金より最終額が多い・同じ・少ない三ケースの表示と保存が一致する。
- 前受済みキャンセルが全額返金表示になる。
- 管理者の機微payload開示後に閲覧eventが増え、他ロールは開示できない。
- 通常画面へ英字の状態・ロール・診療メニューがvisible textとして出ない。
- ページ全体の横overflowがない。

- [ ] **Step 7: 最終checkpointをcommit/pushし、Draft PRを更新または作成する**

```bash
git add examples/final/README.md examples/final/src/adaptor/primary/web/pages.gen.ts apps/docs/src/pages/sessions/final.astro apps/docs/src/test/pages/sessions/final.test.ts
git commit -m "docs(final): 予約受付と機微監査の説明を同期"
git push
gh pr view --json number,url,state
```

同じbranchの未完了PRがあれば本文へ実装結果と検証結果を追記する。なければ、リポジトリ規約に従い背景・内容・論点を持つDraft PRを作成する。pushまたはPR操作が失敗した場合は、force pushやローカルmergeで迂回せず、失敗内容を報告して停止する。

## Completion Checklist

- [ ] 仕様書の受け入れ条件1〜18をtestまたは手動確認へ一対一で対応付けた。
- [ ] 監査metadata、通常payload、機微payloadのいずれにも孤児または二重保存がない。
- [ ] 来院理由、受付メモ、PII、診療情報、settlement内訳が機微テーブルへ保存される。
- [ ] 機微payload閲覧失敗時に値を返さず、成功時だけ通常の閲覧eventを残す。
- [ ] 担当医未定以外の `Scheduled` / `CheckedIn` 重複を並行操作でも防ぐ。
- [ ] すべてのmutationがversionを増やし、古いexpectedVersionを拒否する。
- [ ] 予防接種だけ前受可能で、最終精算とキャンセル返金が原子的である。
- [ ] calendar、reception、detail、auditのpropsが用途外の機微値を含まない。
- [ ] frontend visible textが日本語で統一されている。
- [ ] package/rootのtypecheck、test、buildがすべて成功した。
