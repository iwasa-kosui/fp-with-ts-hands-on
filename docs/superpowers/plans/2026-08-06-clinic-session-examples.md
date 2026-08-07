# Clinic Session Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動物病院サンプルをセッション開始時点ごとの独立 package に分け、最後に Kamae に従った完成例と対応する docs を提供します。

**Architecture:** `examples/session-00` から `examples/session-05` を、前 package に依存しない累積スナップショットとして作成します。`examples/final` は Zod、neverthrow、判別共用体、純粋な状態遷移、原子的な状態・イベント保存、PII 保護を統合します。docs は `/sessions/...` へ移し、各ページが同じ番号の開始 package だけを参照するようにします。

**Tech Stack:** TypeScript 5.9、pnpm 9.12、Vitest 2.1、Zod 3.25、neverthrow 8、Astro 5、Cloudflare Workers

## Global Constraints

- `session-NN` は Session NN の開始時点です。`final` は Session 05 終了時点であり、`session-06` は作りません。
- 各 example は自己完結させ、別の session package や共通の内部 package に依存させません。
- `session-00` と `session-01` には Zod と neverthrow を入れません。
- Zod は `session-03` 以降、neverthrow は `session-04` 以降だけに入れます。
- 予約、ペット、飼い主、獣医師、検査、イベントの識別子はすべて UUID 形式にします。Zod 導入後は用途ごとに別の brand を付けます。
- 通常の `typecheck`、`test`、`build` は成功させます。各 `exercise:NN` は開始状態で想定した理由により失敗させます。
- exercise ファイルは package の通常 `tsconfig.json` と `vitest.config.ts` の対象から外します。
- final のドメイン型は `type`、`Readonly<>`、`kind`、companion object、関数プロパティ記法を使います。
- final のドメインコードでは例外と型アサーションを使いません。許可する型アサーションは `as const` と `as const satisfies Type` だけです。
- final の外部入力は Zod schema で検証し、neverthrow の `Result` に変換します。
- final の状態と domain event は `save(state, events)` で一括保存します。実 DB と outbox は追加しません。
- docs の公開 URL は `/sessions/...` へ変更し、旧 `/modules/...` の互換ページと redirect は作りません。
- `/module-00` の既存 alias は残し、redirect 先だけ `/sessions/00-break-the-app/` へ変更します。
- 過去の `docs/superpowers/plans/` と設計仕様内にある旧パスは、履歴説明として機械的に置換しません。
- 長文 docs は `communication-style.md` の検査キーワードで確認します。

---

### Task 1: Session 00 の事故再現 package

**Files:**

- Modify: `pnpm-workspace.yaml`
- Create: `examples/session-00/package.json`
- Create: `examples/session-00/tsconfig.json`
- Create: `examples/session-00/vitest.config.ts`
- Create: `examples/session-00/vitest.exercises.config.ts`
- Create: `examples/session-00/README.md`
- Create: `examples/session-00/src/logger.ts`
- Create: `examples/session-00/src/appointment.ts`
- Create: `examples/session-00/test/setup.test.ts`
- Create: `examples/session-00/exercises/incident.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: ルートの `tsconfig.base.json` と pnpm workspace。
- Produces: package `@fp-with-ts/clinic-session-00`、`bookAppointment(input): LegacyAppointment`、`updateStatus(id, newStatus, extra?): LegacyAppointment`、`resetLegacyStore(): void`。

- [ ] **Step 1: workspace と package の失敗する契約テストを追加**

`pnpm-workspace.yaml` に `examples/*` を追加します。package 設定は exercise を通常検証から分離します。

```json
{
  "name": "@fp-with-ts/clinic-session-00",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts` は `test/**/*.test.ts`、`vitest.exercises.config.ts` は `exercises/**/*.test.ts` だけを対象にします。

通常テストでは予約から会計までの既存フローを固定します。

```typescript
const appointmentInput = {
  id: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  petName: "Mugi",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
} as const satisfies BookAppointmentInput;

describe("Session 00 setup", () => {
  beforeEach(resetLegacyStore);

  it("予約から会計までの通常フローは動く", () => {
    const scheduled = bookAppointment(appointmentInput);
    const checkedIn = updateStatus(scheduled.id, "checked-in");
    const examining = updateStatus(checkedIn.id, "in-examination", {
      veterinarianId: "44444444-4444-4444-8444-444444444444",
    });
    const paid = updateStatus(examining.id, "paid", {
      diagnosis: "dermatitis",
      treatment: "ointment",
      amount: 4800,
    });

    expect(paid.status).toBe("paid");
    expect(paid.amount).toBe(4800);
  });
});
```

- [ ] **Step 2: 通常テストを実行して source 不在の失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Expected: FAIL。`src/appointment.ts` が存在しないため import を解決できません。

- [ ] **Step 3: legacy 実装を package 内へ移植**

`LegacyAppointment` は事故の原因を残すため、status と状態固有情報を閉じません。

```typescript
export type LegacyStatusExtra = Readonly<{
  veterinarianId?: string;
  diagnosis?: string;
  treatment?: string;
  amount?: number;
  cancelReason?: string;
  followUpRequestedAt?: string;
}>;

export type LegacyAppointment = Readonly<{
  id: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  scheduledAt: string;
  reason: string;
  status: string;
}> & LegacyStatusExtra;

export const updateStatus = (
  id: string,
  newStatus: string,
  extra: LegacyStatusExtra = {},
): LegacyAppointment => {
  const current = appointments.get(id);
  if (current === undefined) throw new Error(`Appointment not found: ${id}`);
  const updated = { ...current, ...extra, status: newStatus };
  appointments.set(id, updated);
  logger.info("appointment status updated", updated);
  return updated;
};
```

`logger.info` は payload をそのまま `JSON.stringify` し、事故時点の PII 漏えいを再現します。README には「Session 00 開始時点」「`pnpm test` は成功」「`pnpm exercise` は事故を再現して失敗」と記載します。

- [ ] **Step 4: 通常テストの成功を確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Expected: PASS。通常フローの1テストが成功します。

- [ ] **Step 5: 事故を再現する exercise を追加して失敗を確認**

```typescript
const createPaidAppointmentThroughLegacyApi = (): LegacyAppointment => {
  const scheduled = bookAppointment(appointmentInput);
  updateStatus(scheduled.id, "checked-in");
  updateStatus(scheduled.id, "in-examination", {
    veterinarianId: "44444444-4444-4444-8444-444444444444",
  });
  return updateStatus(scheduled.id, "paid", {
    diagnosis: "dermatitis",
    treatment: "ointment",
    amount: 4800,
  });
};

it("会計済みの来院は診察中に戻せないはず", () => {
  const paid = createPaidAppointmentThroughLegacyApi();
  const actual = updateStatus(paid.id, "in-examination", {
    veterinarianId: "55555555-5555-4555-8555-555555555555",
  });

  expect(actual.status).toBe("paid");
});
```

Run: `pnpm --filter @fp-with-ts/clinic-session-00 exercise`

Expected: FAIL。actual status が `in-examination` になり、会計済みの来院を戻せる事故を確認できます。

- [ ] **Step 6: Session 00 をコミット**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml examples/session-00
git commit -m "feat(examples): add session 00 incident snapshot"
```

### Task 2: Session 01 の要求固定 package

**Files:**

- Create: `examples/session-01/package.json`
- Create: `examples/session-01/tsconfig.json`
- Create: `examples/session-01/vitest.config.ts`
- Create: `examples/session-01/vitest.exercises.config.ts`
- Create: `examples/session-01/README.md`
- Create: `examples/session-01/src/logger.ts`
- Create: `examples/session-01/src/appointment.ts`
- Create: `examples/session-01/src/visit-lifecycle.ts`
- Create: `examples/session-01/test/setup.test.ts`
- Create: `examples/session-01/test/incident-requirements.test.ts`
- Create: `examples/session-01/exercises/state-modeling.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 00 の legacy API。
- Produces: package `@fp-with-ts/clinic-session-01`、`VisitLifecycle` の要求一覧、Session 01 で実装する `Appointment` API の exercise 契約。

- [ ] **Step 1: Session 01 の package と要求テストを追加**

package scripts、tsconfig、Vitest 設定は次の値で独立定義します。

```json
{
  "name": "@fp-with-ts/clinic-session-01",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

要求データは実装の status 文字列とは切り離して定義します。

```typescript
export type VisitLifecycle = Readonly<{
  states: readonly ["Scheduled", "CheckedIn", "InExamination", "Paid", "Canceled"];
  terminalStates: readonly ["Paid", "Canceled"];
  cancellationRequires: readonly ["reason", "canceledAt"];
}>;

export const visitLifecycle = {
  states: ["Scheduled", "CheckedIn", "InExamination", "Paid", "Canceled"],
  terminalStates: ["Paid", "Canceled"],
  cancellationRequires: ["reason", "canceledAt"],
} as const satisfies VisitLifecycle;
```

`incident-requirements.test.ts` は5状態、2終端状態、キャンセル必須情報を正確に検証します。

- [ ] **Step 2: 要求テストの失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test`

Expected: FAIL。`src/visit-lifecycle.ts` と legacy source が未作成です。

- [ ] **Step 3: legacy 実装と要求データを追加**

Session 01 の source はまだ `status: string` と optional fields を維持します。状態管理は package 内に閉じ、Session 00 と同じ事故を再現できる実装にします。

```typescript
const appointments = new Map<string, LegacyAppointment>();

export const bookAppointment = (input: BookAppointmentInput): LegacyAppointment => {
  const appointment = { ...input, status: "scheduled" };
  appointments.set(appointment.id, appointment);
  logger.info("appointment booked", appointment);
  return appointment;
};

export const updateStatus = (
  id: string,
  newStatus: string,
  extra: LegacyStatusExtra = {},
): LegacyAppointment => {
  const current = appointments.get(id);
  if (current === undefined) throw new Error(`Appointment not found: ${id}`);
  const updated = { ...current, ...extra, status: newStatus };
  appointments.set(id, updated);
  logger.info("appointment status updated", updated);
  return updated;
};

export const resetLegacyStore = (): void => appointments.clear();
```

README に Session 00 の事故分析を終え、状態モデリングは未実装であることを記載します。

- [ ] **Step 4: 通常テストの成功を確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-01 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test`

Expected: PASS。legacy 通常フローと要求固定のテストが成功します。

- [ ] **Step 5: 状態モデリング exercise を追加して失敗を確認**

```typescript
it("診察開始と理由付きキャンセルを表現できる", async () => {
  const { Appointment } = await import("../src/domain/appointment.js");
  const scheduled = Appointment.book({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    petId: "22222222-2222-4222-8222-222222222222",
    ownerId: "33333333-3333-4333-8333-333333333333",
    scheduledAt: "2026-08-30T06:30:00.000Z",
    reason: "skin check",
  });
  const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
  const examining = Appointment.startExamination(
    checkedIn,
    "44444444-4444-4444-8444-444444444444",
    "2026-08-30T06:30:00.000Z",
  );
  const canceled = Appointment.cancelWithReason(
    scheduled,
    "owner-request",
    "2026-08-29T10:00:00.000Z",
    "2026-09-15T00:00:00.000Z",
  );

  expect(examining.kind).toBe("InExamination");
  expect(canceled).toMatchObject({ kind: "Canceled", reason: "owner-request" });
});
```

Run: `pnpm --filter @fp-with-ts/clinic-session-01 exercise`

Expected: FAIL。`src/domain/appointment.ts` が存在しません。

- [ ] **Step 6: Session 01 をコミット**

```bash
git add pnpm-lock.yaml examples/session-01
git commit -m "feat(examples): add session 01 requirements snapshot"
```

### Task 3: Session 02 の型駆動状態モデル package

**Files:**

- Create: `examples/session-02/package.json`
- Create: `examples/session-02/tsconfig.json`
- Create: `examples/session-02/vitest.config.ts`
- Create: `examples/session-02/vitest.exercises.config.ts`
- Create: `examples/session-02/README.md`
- Create: `examples/session-02/src/domain/appointment.ts`
- Create: `examples/session-02/test/state-modeling.test.ts`
- Create: `examples/session-02/exercises/boundary-and-ids.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 01 の5状態、2終端状態、キャンセル必須情報。
- Produces: `Scheduled | CheckedIn | InExamination | Paid | Canceled`、`Appointment.book/checkIn/startExamination/recordPayment/cancelWithReason/isTerminal`。この段階の ID は string です。

- [ ] **Step 1: 状態遷移の通常テストを先に追加**

package は Vitest だけに依存し、Zod と neverthrow は追加しません。

```json
{
  "name": "@fp-with-ts/clinic-session-02",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

通常テストは Scheduled → CheckedIn → InExamination → Paid、理由付き Canceled、終端判定を検証します。型検査用に次の契約も置きます。

```typescript
const scheduled = Appointment.book({
  appointmentId: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  ownerId: "33333333-3333-4333-8333-333333333333",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
});
const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
const startedAt = "2026-08-30T06:30:00.000Z";
const examining = Appointment.startExamination(
  checkedIn,
  "44444444-4444-4444-8444-444444444444",
  startedAt,
);
const paymentInput = {
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
} as const;
const paidAt = "2026-08-30T07:00:00.000Z";
const canceledAt = "2026-08-29T10:00:00.000Z";
const paid = Appointment.recordPayment(examining, paymentInput, paidAt);

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(paid, "55555555-5555-4555-8555-555555555555", startedAt);

// @ts-expect-error Paid はキャンセルできません。
Appointment.cancelWithReason(paid, "owner-request", canceledAt);
```

- [ ] **Step 2: source 不在の失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-02 typecheck`

Expected: FAIL。`src/domain/appointment.ts` を解決できません。

- [ ] **Step 3: primitive ID の状態モデルを実装**

各状態は必要な情報を直接持ちます。基底型との intersection は使いません。

```typescript
export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: string): CheckedIn => ({
    ...appointment,
    kind: "CheckedIn",
    checkedInAt: now,
  }),
  startExamination: (
    appointment: CheckedIn,
    veterinarianId: string,
    now: string,
  ): InExamination => ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt: now,
  }),
  isTerminal: (appointment: Appointment) =>
    appointment.kind === "Paid" || appointment.kind === "Canceled",
} as const;
```

`InExamination`、`Paid`、`Canceled` も状態固有情報を必須にし、`recordPayment` と `cancelWithReason` を入力型で制限します。

- [ ] **Step 4: 状態モデルの検証**

Run: `pnpm --filter @fp-with-ts/clinic-session-02 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-02 test`

Expected: PASS。状態遷移2テストと compile-time contract が成功します。

- [ ] **Step 5: 境界防御 exercise を追加して失敗を確認**

```typescript
const rawExamResult = {
  examId: "77777777-7777-4777-8777-777777777777",
  petId: "22222222-2222-4222-8222-222222222222",
  collectedAt: "2026-08-30T06:50:00.000Z",
  needsFollowUp: true,
  items: ["skin scraping"],
};
const rawOwnerContact = {
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
};

it("外部検査 payload を検証し、連絡先はログで伏せる", async () => {
  const [{ ExamResult }, { OwnerContact }] = await Promise.all([
    import("../src/boundary/exam-result.js"),
    import("../src/boundary/owner-contact.js"),
  ]);
  const exam = ExamResult.safeParse(rawExamResult);
  const contact = OwnerContact.safeParse(rawOwnerContact);

  expect(exam.success).toBe(true);
  expect(contact.success).toBe(true);
  expect(JSON.stringify(contact.success ? contact.data : null)).toContain("[REDACTED]");
  expect(JSON.stringify(contact.success ? contact.data : null)).not.toContain("owner@example.test");
});
```

Run: `pnpm --filter @fp-with-ts/clinic-session-02 exercise`

Expected: FAIL。境界用 source が存在しません。

- [ ] **Step 6: Session 02 をコミット**

```bash
git add pnpm-lock.yaml examples/session-02
git commit -m "feat(examples): add session 02 state model snapshot"
```

### Task 4: Session 03 の境界・ID・PII package

**Files:**

- Create: `examples/session-03/package.json`
- Create: `examples/session-03/tsconfig.json`
- Create: `examples/session-03/vitest.config.ts`
- Create: `examples/session-03/vitest.exercises.config.ts`
- Create: `examples/session-03/README.md`
- Create: `examples/session-03/src/domain/appointment.ts`
- Create: `examples/session-03/src/domain/appointment-id.ts`
- Create: `examples/session-03/src/domain/pet-id.ts`
- Create: `examples/session-03/src/domain/owner-id.ts`
- Create: `examples/session-03/src/domain/veterinarian-id.ts`
- Create: `examples/session-03/src/domain/exam-id.ts`
- Create: `examples/session-03/src/boundary/exam-result.ts`
- Create: `examples/session-03/src/boundary/owner-contact.ts`
- Create: `examples/session-03/src/shared/sensitive.ts`
- Create: `examples/session-03/test/state-modeling.test.ts`
- Create: `examples/session-03/test/boundary-and-ids.test.ts`
- Create: `examples/session-03/exercises/result-errors.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 02 の `Appointment` 状態と遷移。
- Produces: Zod branded `AppointmentId`、`PetId`、`OwnerId`、`VeterinarianId`、`ExamResult.safeParse`、`OwnerContact.safeParse`、`Sensitive<T>`。

- [ ] **Step 1: branded ID と境界の通常テストを追加**

```json
{
  "name": "@fp-with-ts/clinic-session-03",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "dependencies": { "zod": "^3.25.0" },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

テストは不正な ExamResult、ID の混同拒否、連絡先の JSON／文字列マスクを検証します。

```typescript
const petId = PetId.safeParse("22222222-2222-4222-8222-222222222222");
expect(petId.success).toBe(true);

if (petId.success) {
  // @ts-expect-error PetId を OwnerId として使えません。
  const ownerId: OwnerId = petId.data;
  void ownerId;
}
```

- [ ] **Step 2: 境界 source 不在の失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-03 typecheck`

Expected: FAIL。branded ID と boundary source を解決できません。

- [ ] **Step 3: Zod branded ID を実装**

5種類の ID は同じ UUID schema を使い、brand だけを変えます。

```typescript
export const AppointmentIdBrand = Symbol();
const AppointmentIdSchema = z.string().uuid().brand<typeof AppointmentIdBrand>();
export type AppointmentId = z.infer<typeof AppointmentIdSchema>;

export const AppointmentId = {
  schema: AppointmentIdSchema,
  safeParse: (raw: unknown) => AppointmentIdSchema.safeParse(raw),
} as const;
```

`PetId`、`OwnerId`、`VeterinarianId`、`ExamId` も `z.string().uuid()` を使い、それぞれ異なる brand を付けます。Appointment と ExamResult の ID field、状態遷移の引数を対応する branded type へ変更します。

- [ ] **Step 4: ExamResult と Sensitive な OwnerContact を実装**

```typescript
export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
  }),
} as const;
```

```typescript
const ExamResultSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  collectedAt: z.string().datetime(),
  needsFollowUp: z.boolean().default(false),
  items: z.array(z.string().min(1)).min(1),
});

export type ExamResult = z.infer<typeof ExamResultSchema>;
export const ExamResult = {
  schema: ExamResultSchema,
  safeParse: (raw: unknown) => ExamResultSchema.safeParse(raw),
} as const;
```

OwnerContact schema は `ownerName`、`ownerEmail`、`ownerPhone` を検証後に `Sensitive.of` で包みます。

- [ ] **Step 5: 通常テストの成功を確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-03 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-03 test`

Expected: PASS。状態モデル、boundary、brand、PII のテストが成功します。

- [ ] **Step 6: Result と event の exercise を追加して失敗を確認**

```typescript
it("成功した診察開始だけを domain event に残す", async () => {
  const [{ startExaminationUseCase }, { createInMemoryAppointmentRepository }, { createInMemoryDomainEventStore }] =
    await Promise.all([
      import("../src/application/start-examination.js"),
      import("../src/infrastructure/in-memory-appointment-repository.js"),
      import("../src/infrastructure/in-memory-domain-event-store.js"),
    ]);

  const result = startExaminationUseCase(repository, eventStore)(rawInput);
  expect(result.isOk()).toBe(true);
  expect(eventStore.all()).toHaveLength(1);
});
```

Run: `pnpm --filter @fp-with-ts/clinic-session-03 exercise`

Expected: FAIL。application と infrastructure source が存在しません。

- [ ] **Step 7: Session 03 をコミット**

```bash
git add pnpm-lock.yaml examples/session-03
git commit -m "feat(examples): add session 03 boundary snapshot"
```

### Task 5: Session 04 の Result・repository・domain event package

**Files:**

- Create: `examples/session-04/package.json`
- Create: `examples/session-04/tsconfig.json`
- Create: `examples/session-04/vitest.config.ts`
- Create: `examples/session-04/vitest.exercises.config.ts`
- Create: `examples/session-04/README.md`
- Create: `examples/session-04/src/domain/appointment.ts`
- Create: `examples/session-04/src/domain/appointment-id.ts`
- Create: `examples/session-04/src/domain/pet-id.ts`
- Create: `examples/session-04/src/domain/owner-id.ts`
- Create: `examples/session-04/src/domain/veterinarian-id.ts`
- Create: `examples/session-04/src/domain/exam-id.ts`
- Create: `examples/session-04/src/domain/examination-started.ts`
- Create: `examples/session-04/src/boundary/exam-result.ts`
- Create: `examples/session-04/src/boundary/owner-contact.ts`
- Create: `examples/session-04/src/shared/sensitive.ts`
- Create: `examples/session-04/src/shared/schema-result.ts`
- Create: `examples/session-04/src/application/start-examination-error.ts`
- Create: `examples/session-04/src/application/start-examination.ts`
- Create: `examples/session-04/src/ports/appointment-repository.ts`
- Create: `examples/session-04/src/ports/domain-event-store.ts`
- Create: `examples/session-04/src/infrastructure/in-memory-appointment-repository.ts`
- Create: `examples/session-04/src/infrastructure/in-memory-domain-event-store.ts`
- Create: `examples/session-04/test/state-modeling.test.ts`
- Create: `examples/session-04/test/boundary-and-ids.test.ts`
- Create: `examples/session-04/test/result-errors.test.ts`
- Create: `examples/session-04/exercises/agent-review.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 03 の branded domain types と Zod schemas。
- Produces: neverthrow `Result` を返す `schemaResult`、`startExaminationUseCase(repository, eventStore)(rawInput)`、分離した `AppointmentRepository` と `DomainEventStore`。この段階では dual-write を意図的に残します。

- [ ] **Step 1: Result と event の通常テストを追加**

```json
{
  "name": "@fp-with-ts/clinic-session-04",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "dependencies": {
    "neverthrow": "^8.2.0",
    "zod": "^3.25.0"
  },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

`result-errors.test.ts` は次を検証します。

```typescript
const success = startExaminationUseCase(repository, eventStore)(validInput);
expect(success.isOk()).toBe(true);
expect(eventStore.all()).toHaveLength(1);
expect(eventStore.all()[0]?.kind).toBe("ExaminationStarted");

const notFound = startExaminationUseCase(emptyRepository, emptyEventStore)(validInput);
expect(notFound.isErr() && notFound.error.kind).toBe("AppointmentNotFound");

const invalidState = startExaminationUseCase(scheduledRepository, emptyEventStore)(validInput);
expect(invalidState.isErr() && invalidState.error.kind).toBe("InvalidAppointmentState");

const invalidId = startExaminationUseCase(repository, emptyEventStore)({
  ...validInput,
  appointmentId: "invalid",
});
expect(invalidId.isErr() && invalidId.error.kind).toBe("ValidationError");
```

全失敗ケースで repository の状態が変わらず、event store が空であることも検証します。

- [ ] **Step 2: application source 不在の失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-04 typecheck`

Expected: FAIL。start-examination、ports、in-memory 実装が存在しません。

- [ ] **Step 3: Zod から neverthrow へ変換する factory を実装**

```typescript
export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<z.ZodIssue>;
}>;

export const schemaResult = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "ValidationError", issues: parsed.error.issues });
  };
```

ID companion と入力 schema は `safeParse` ではなく `parse: schemaResult(schema)` を公開します。

- [ ] **Step 4: repository、event store、error を値として実装**

```typescript
export type AppointmentRepository = Readonly<{
  findById: (id: AppointmentId) => Appointment | undefined;
  save: (appointment: Appointment) => void;
}>;

export type DomainEventStore = Readonly<{
  append: (event: ExaminationStarted) => void;
  all: () => ReadonlyArray<ExaminationStarted>;
}>;
```

```typescript
export type StartExaminationError =
  | Readonly<{ kind: "AppointmentNotFound"; appointmentId: AppointmentId }>
  | Readonly<{
      kind: "InvalidAppointmentState";
      appointmentId: AppointmentId;
      actualKind: Appointment["kind"];
      expectedKind: "CheckedIn";
    }>
  | ValidationError;
```

`ExaminationStarted` は `eventId`、`occurredAt`、`appointmentId`、`veterinarianId` を持つ immutable record とし、companion の `create` で `kind` を付加します。

- [ ] **Step 5: dual-write を残した start examination を実装**

```typescript
const StartExaminationInputSchema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
  eventId: z.string(),
  occurredAt: z.string(),
});

export type StartExaminationInput = z.infer<typeof StartExaminationInputSchema>;

export const StartExaminationInput = {
  schema: StartExaminationInputSchema,
  parse: schemaResult(StartExaminationInputSchema),
} as const;

export const startExaminationUseCase = (
  repository: AppointmentRepository,
  eventStore: DomainEventStore,
) => (raw: unknown): Result<InExamination, StartExaminationError> =>
  StartExaminationInput.parse(raw)
    .andThen((input) =>
      ensureFound(repository.findById(input.appointmentId), input.appointmentId)
        .andThen(ensureCheckedIn)
        .map((checkedIn) => ({ input, checkedIn })),
    )
    .map(({ input, checkedIn }) => ({
      input,
      examining: Appointment.startExamination(
        checkedIn,
        input.veterinarianId,
        input.occurredAt,
      ),
    }))
    .map(({ input, examining }) => {
      repository.save(examining);
      eventStore.append(ExaminationStarted.create({
        eventId: input.eventId,
        occurredAt: input.occurredAt,
        appointmentId: examining.appointmentId,
        veterinarianId: examining.veterinarianId,
      }));
      return examining;
    });
```

eventId と occurredAt はこの段階では形式を絞らず、Session 04 のレビュー対象として残します。保存と append も意図的に別操作のままにします。

- [ ] **Step 6: 通常テストの成功を確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-04 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-04 test`

Expected: PASS。状態、境界、Result、成功時だけの event 記録を検証できます。

- [ ] **Step 7: agent review exercise を追加して失敗を確認**

```typescript
it("横断レビューが dual-write と PII inspect を検出する", async () => {
  const { agentReviewChecklist, buildFollowUpAgentPrompt } =
    await import("../src/review/agent-review.js");
  expect(agentReviewChecklist.map(({ kind }) => kind)).toEqual([
    "StateTransition",
    "BoundaryValidation",
    "SensitiveData",
    "ResultError",
    "DomainEvent",
  ]);
  const prompt = buildFollowUpAgentPrompt();
  expect(prompt).toContain("save(state, events)");
  expect(prompt).toContain("nodejs.util.inspect.custom");
});
```

Run: `pnpm --filter @fp-with-ts/clinic-session-04 exercise`

Expected: FAIL。review source が存在しません。

- [ ] **Step 8: Session 04 をコミット**

```bash
git add pnpm-lock.yaml examples/session-04
git commit -m "feat(examples): add session 04 result snapshot"
```

### Task 6: Session 05 のレビュー反映 package

**Files:**

- Create: `examples/session-05/package.json`
- Create: `examples/session-05/tsconfig.json`
- Create: `examples/session-05/vitest.config.ts`
- Create: `examples/session-05/vitest.exercises.config.ts`
- Create: `examples/session-05/README.md`
- Create: `examples/session-05/src/domain/appointment.ts`
- Create: `examples/session-05/src/domain/appointment-id.ts`
- Create: `examples/session-05/src/domain/pet-id.ts`
- Create: `examples/session-05/src/domain/owner-id.ts`
- Create: `examples/session-05/src/domain/veterinarian-id.ts`
- Create: `examples/session-05/src/domain/exam-id.ts`
- Create: `examples/session-05/src/domain/event-id.ts`
- Create: `examples/session-05/src/domain/timestamp.ts`
- Create: `examples/session-05/src/domain/examination-started.ts`
- Create: `examples/session-05/src/domain/clinic-domain-event.ts`
- Create: `examples/session-05/src/boundary/exam-result.ts`
- Create: `examples/session-05/src/boundary/owner-contact.ts`
- Create: `examples/session-05/src/shared/sensitive.ts`
- Create: `examples/session-05/src/shared/schema-result.ts`
- Create: `examples/session-05/src/application/start-examination-error.ts`
- Create: `examples/session-05/src/application/start-examination.ts`
- Create: `examples/session-05/src/ports/appointment-resolver.ts`
- Create: `examples/session-05/src/ports/appointment-store.ts`
- Create: `examples/session-05/src/infrastructure/in-memory-appointment-gateway.ts`
- Create: `examples/session-05/src/review/agent-review.ts`
- Create: `examples/session-05/test/fixtures.ts`
- Create: `examples/session-05/test/state-modeling.test.ts`
- Create: `examples/session-05/test/boundary-and-ids.test.ts`
- Create: `examples/session-05/test/start-examination.test.ts`
- Create: `examples/session-05/test/agent-review.test.ts`
- Create: `examples/session-05/exercises/follow-up.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 04 の start examination と、レビューで検出した dual-write、PII inspect、未検証 event input、責務集中。
- Produces: `AppointmentResolver.findById`、`AppointmentStore.save(state, events)`、inspect-safe `Sensitive<T>`、review artifact。電話フォロー API はまだ提供しません。

- [ ] **Step 1: atomic save と PII inspect の失敗するテストを追加**

package dependencies は Session 04 と同じです。

```json
{
  "name": "@fp-with-ts/clinic-session-05",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "exercise": "vitest run --config vitest.exercises.config.ts"
  },
  "dependencies": {
    "neverthrow": "^8.2.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^2.1.0"
  }
}
```

Session 05 の `tsconfig.json` は `compilerOptions.types` に `"vitest/globals"` と `"node"` を指定します。

```typescript
// test/fixtures.ts
const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();
const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444")._unsafeUnwrap();
const scheduledAt = Timestamp.parse("2026-08-30T06:00:00.000Z")._unsafeUnwrap();
const checkedInAt = Timestamp.parse("2026-08-30T06:20:00.000Z")._unsafeUnwrap();
const startedAt = Timestamp.parse("2026-08-30T06:30:00.000Z")._unsafeUnwrap();
const paidAt = Timestamp.parse("2026-08-30T07:00:00.000Z")._unsafeUnwrap();

const scheduled = Appointment.book({
  appointmentId,
  petId,
  ownerId,
  scheduledAt,
  reason: "skin check",
});
export const checkedIn = Appointment.checkIn(scheduled, checkedInAt);
const examining = Appointment.startExamination(checkedIn, veterinarianId, startedAt);
export const paidAppointment = Appointment.recordPayment(examining, {
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
}, paidAt);

export const ownerContact = OwnerContact.parse({
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
})._unsafeUnwrap();

export const validRawInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  eventId: "66666666-6666-4666-8666-666666666666",
  occurredAt: "2026-08-30T06:30:00.000Z",
} as const;

it("状態とイベントを一度の save で保存する", () => {
  const gateway = createInMemoryAppointmentGateway([checkedIn]);
  const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

  expect(result.isOk()).toBe(true);
  expect(gateway.saveCalls()).toHaveLength(1);
  expect(gateway.events()).toHaveLength(1);
  expect(gateway.events()[0]?.kind).toBe("ExaminationStarted");
});

it("Node inspect でも連絡先を公開しない", () => {
  const contact = OwnerContact.parse({
    ownerName: "Owner A",
    ownerEmail: "owner@example.test",
    ownerPhone: "090-0000-0000",
  })._unsafeUnwrap();
  expect(inspect(contact)).toContain("[REDACTED]");
  expect(inspect(contact)).not.toContain("owner@example.test");
});
```

- [ ] **Step 2: Session 04 相当の source では失敗することを確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-session-05 typecheck`

Expected: FAIL。atomic gateway、EventId、Timestamp、inspect 対応 Sensitive が存在しません。

- [ ] **Step 3: event boundary と Sensitive を強化**

`EventId` は `z.string().uuid()`、`Timestamp` は `z.string().datetime()` の schema と `schemaResult` を持つ companion object にします。

```typescript
export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;
```

- [ ] **Step 4: resolver と atomic store を実装**

```typescript
export type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: "FindById" | "Save";
}>;

export type AppointmentResolver = Readonly<{
  findById: (
    appointmentId: AppointmentId,
  ) => Result<Appointment | undefined, RepositoryError>;
}>;

export type AppointmentStore = Readonly<{
  save: (
    state: Appointment,
    events: ReadonlyArray<ClinicDomainEvent>,
  ) => Result<void, RepositoryError>;
}>;
```

`createInMemoryAppointmentGateway(initial)` は `resolver`、`store`、`appointments()`、`events()`、`saveCalls()` を返します。`save` は次の state map と event list を作ってから両方を同時に差し替え、片方だけを更新しません。

- [ ] **Step 5: start examination を atomic pipeline へ変更**

```typescript
export const startExaminationUseCase = (
  resolver: AppointmentResolver,
  store: AppointmentStore,
) => (raw: unknown): Result<InExamination, StartExaminationError> =>
  StartExaminationInput.parse(raw)
    .andThen((input) =>
      resolver
        .findById(input.appointmentId)
        .andThen(ensureFound(input.appointmentId))
        .andThen(ensureCheckedIn)
        .map((checkedIn) => ({ input, checkedIn })),
    )
    .map(({ input, checkedIn }) => ({
      input,
      examining: Appointment.startExamination(
        checkedIn,
        input.veterinarianId,
        input.occurredAt,
      ),
    }))
    .andThrough(({ input, examining }) =>
      store.save(examining, [ExaminationStarted.create({
        eventId: input.eventId,
        occurredAt: input.occurredAt,
        appointmentId: examining.appointmentId,
        veterinarianId: examining.veterinarianId,
      })]),
    )
    .map(({ examining }) => examining);
```

`StartExaminationError` に `RepositoryError` を追加します。

- [ ] **Step 6: agent review artifact を実装**

`ReviewPrincipleKind` は `StateTransition | BoundaryValidation | SensitiveData | ResultError | DomainEvent` とします。checklist の各項目は `mustMention` を持ち、prompt は `save(state, events)`、`nodejs.util.inspect.custom`、unknown validation、Result error、event atomicity を含めます。

```typescript
export type ReviewPrincipleKind =
  | "StateTransition"
  | "BoundaryValidation"
  | "SensitiveData"
  | "ResultError"
  | "DomainEvent";

export type AgentReviewChecklistItem = Readonly<{
  kind: ReviewPrincipleKind;
  mustMention: ReadonlyArray<string>;
}>;

export const agentReviewChecklist = [
  { kind: "StateTransition", mustMention: ["kind", "pure transition"] },
  { kind: "BoundaryValidation", mustMention: ["unknown", "schema"] },
  { kind: "SensitiveData", mustMention: ["nodejs.util.inspect.custom"] },
  { kind: "ResultError", mustMention: ["Result", "kind"] },
  { kind: "DomainEvent", mustMention: ["save(state, events)", "atomic"] },
] as const satisfies ReadonlyArray<AgentReviewChecklistItem>;

export const buildFollowUpAgentPrompt = (): string =>
  agentReviewChecklist
    .flatMap(({ kind, mustMention }) => [`## ${kind}`, ...mustMention])
    .join("\n");
```

- [ ] **Step 7: 通常テストの成功を確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test`

Expected: PASS。状態、境界、atomic save、PII inspect、レビュー契約を検証できます。

- [ ] **Step 8: 電話フォロー exercise を追加して失敗を確認**

```typescript
import { paidAppointment } from "../test/fixtures.js";

const rawCandidates = [{
  appointment: paidAppointment,
  ownerContact: {
    ownerName: "Owner A",
    ownerEmail: "owner@example.test",
    ownerPhone: "090-0000-0000",
  },
  examResult: {
    examId: "77777777-7777-4777-8777-777777777777",
    petId: "22222222-2222-4222-8222-222222222222",
    collectedAt: "2026-08-30T06:50:00.000Z",
    needsFollowUp: true,
    items: ["skin scraping"],
  },
  eventId: "66666666-6666-4666-8666-666666666666",
  occurredAt: "2026-08-30T07:00:00.000Z",
}] as const;

it("電話フォロー対象と event を副作用なしに組み立てる", async () => {
  const { collectFollowUpTargets } =
    await import("../src/application/collect-follow-up-targets.js");
  const result = collectFollowUpTargets(rawCandidates);

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.event.kind).toBe("FollowUpRequested");
    expect(JSON.stringify(result.value)).not.toContain("090-0000-0000");
  }
});
```

不一致の pet ID を含む候補では `ExamResultPetMismatch` を返し、途中まで生成した結果を返さないテストも置きます。

Run: `pnpm --filter @fp-with-ts/clinic-session-05 exercise`

Expected: FAIL。collect follow-up source が存在しません。

- [ ] **Step 9: Session 05 をコミット**

```bash
git add pnpm-lock.yaml examples/session-05
git commit -m "feat(examples): add session 05 reviewed snapshot"
```

### Task 7: Kamae に従う final package

**Files:**

- Create: `examples/final/package.json`
- Create: `examples/final/tsconfig.json`
- Create: `examples/final/vitest.config.ts`
- Create: `examples/final/README.md`
- Create: `examples/final/src/domain/appointment.ts`
- Create: `examples/final/src/domain/appointment-id.ts`
- Create: `examples/final/src/domain/pet-id.ts`
- Create: `examples/final/src/domain/owner-id.ts`
- Create: `examples/final/src/domain/veterinarian-id.ts`
- Create: `examples/final/src/domain/exam-id.ts`
- Create: `examples/final/src/domain/event-id.ts`
- Create: `examples/final/src/domain/timestamp.ts`
- Create: `examples/final/src/domain/exam-result.ts`
- Create: `examples/final/src/domain/owner-contact.ts`
- Create: `examples/final/src/domain/examination-started.ts`
- Create: `examples/final/src/domain/follow-up-requested.ts`
- Create: `examples/final/src/domain/clinic-domain-event.ts`
- Create: `examples/final/src/shared/sensitive.ts`
- Create: `examples/final/src/shared/schema-result.ts`
- Create: `examples/final/src/shared/assert-never.ts`
- Create: `examples/final/src/application/start-examination-error.ts`
- Create: `examples/final/src/application/start-examination-input.ts`
- Create: `examples/final/src/application/start-examination.ts`
- Create: `examples/final/src/application/follow-up-target.ts`
- Create: `examples/final/src/application/follow-up-candidate.ts`
- Create: `examples/final/src/application/collect-follow-up-targets-error.ts`
- Create: `examples/final/src/application/collect-follow-up-targets.ts`
- Create: `examples/final/src/ports/appointment-resolver.ts`
- Create: `examples/final/src/ports/appointment-store.ts`
- Create: `examples/final/src/infrastructure/in-memory-appointment-gateway.ts`
- Create: `examples/final/test/fixtures.ts`
- Create: `examples/final/test/state-modeling.test.ts`
- Create: `examples/final/test/boundary-defense.test.ts`
- Create: `examples/final/test/start-examination.test.ts`
- Create: `examples/final/test/follow-up.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Session 05 の atomic start examination と、Session 05 exercise の電話フォロー契約。
- Produces: Kamae に従う完成例。`collectFollowUpTargets(raw: unknown): Result<ReadonlyArray<FollowUpTarget>, CollectFollowUpTargetsError>` は副作用を持ちません。

- [ ] **Step 1: final package と全体契約テストを追加**

```json
{
  "name": "@fp-with-ts/clinic-final",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@standard-schema/spec": "^1.0.0",
    "neverthrow": "^8.2.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^2.1.0"
  }
}
```

final の `tsconfig.json` は `compilerOptions.types` に `"vitest/globals"` と `"node"` を指定します。

`fixtures.ts` は parse 済み ID を使い、各 domain object を `as const satisfies Type` で定義します。テストは次の契約を持ちます。

- 無効な状態遷移が `@ts-expect-error` で拒否されます。
- unknown の ID、timestamp、exam result、owner contact が検証されます。
- JSON、文字列、Node inspect のすべてで PII が伏せられます。
- start examination は成功時に状態と event を一回の save で保存します。
- find または save 失敗時は `kind` 付き error を返し、半端な状態を残しません。
- follow-up は Paid、needsFollowUp、pet ID 一致だけを対象にします。
- 後続候補の validation 失敗時も、部分的な target や event を返しません。
- 同じ候補から event を重複生成しません。

- [ ] **Step 2: final source 不在の失敗を確認**

Run: `pnpm install --no-frozen-lockfile`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: FAIL。final の domain、application、ports、infrastructure が存在しません。

- [ ] **Step 3: Standard Schema 形式の schemaResult と Sensitive を実装**

Zod 3.25 の Standard Schema contract と `@standard-schema/spec` の型を使い、validation から neverthrow への変換を一箇所に集約します。

```typescript
export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

export const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const parsed = schema["~standard"].validate(raw);
    if (parsed instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }
    return parsed.issues === undefined
      ? ok(parsed.value)
      : err({ kind: "ValidationError", issues: parsed.issues });
  };
```

同期 schema に Promise 実装を渡す誤用だけはプログラミングエラーとして例外にします。`Sensitive` は Session 05 の3種類のマスクを維持します。

- [ ] **Step 4: 一概念一ファイルの domain model を実装**

各 ID と Timestamp は `schema` と `parse` を持つ companion object にします。Appointment は各状態で共通 field も明示し、状態固有 field を optional にしません。

```typescript
export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (scheduled: Scheduled, checkedInAt: Timestamp): CheckedIn => ({
    ...scheduled,
    kind: "CheckedIn",
    checkedInAt,
  }),
  startExamination: (
    checkedIn: CheckedIn,
    veterinarianId: VeterinarianId,
    examinationStartedAt: Timestamp,
  ): InExamination => ({
    ...checkedIn,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt,
  }),
  recordPayment: (
    examining: InExamination,
    input: RecordPaymentInput,
    paidAt: Timestamp,
  ): Paid => ({ ...examining, ...input, kind: "Paid", paidAt }),
  cancelWithReason: (
    appointment: Scheduled | CheckedIn,
    reason: CancelReason,
    canceledAt: Timestamp,
    followUpRequestedAt?: Timestamp,
  ): Canceled => ({
    kind: "Canceled",
    appointmentId: appointment.appointmentId,
    petId: appointment.petId,
    ownerId: appointment.ownerId,
    scheduledAt: appointment.scheduledAt,
    reason,
    canceledAt,
    ...(followUpRequestedAt === undefined ? {} : { followUpRequestedAt }),
  }),
  isPaid: (appointment: Appointment) => appointment.kind === "Paid",
  isTerminal: (appointment: Appointment) =>
    appointment.kind === "Paid" || appointment.kind === "Canceled",
} as const;
```

- [ ] **Step 5: atomic gateway と start examination pipeline を実装**

Session 05 の resolver/store contract を維持し、`StartExaminationInput.parse(raw)`、`ensureFound`、`ensureCheckedIn`、pure transition、`store.save(state, events)` の順に合成します。gateway の save failure fixture では state map と event list のどちらも更新しません。

- [ ] **Step 6: declarative な電話フォローを実装**

```typescript
export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerPhone: Sensitive<string>;
  event: FollowUpRequested;
}>;

export const FollowUpTarget = {
  fromCandidate: (candidate: FollowUpCandidate): FollowUpTarget => ({
    appointmentId: candidate.appointment.appointmentId,
    petId: candidate.appointment.petId,
    ownerPhone: candidate.ownerContact.ownerPhone,
    event: FollowUpRequested.create({
      eventId: candidate.eventId,
      occurredAt: candidate.occurredAt,
      appointmentId: candidate.appointment.appointmentId,
      petId: candidate.appointment.petId,
    }),
  }),
} as const;
```

`Appointment` companion は `z.discriminatedUnion("kind", ...)` による `schema` も公開します。`FollowUpCandidate` は raw object 全体を一度に parse します。

```typescript
const FollowUpCandidateSchema = z.object({
  appointment: Appointment.schema,
  ownerContact: OwnerContact.schema,
  examResult: ExamResult.schema,
  eventId: EventId.schema,
  occurredAt: Timestamp.schema,
});

export type FollowUpCandidate = z.infer<typeof FollowUpCandidateSchema>;

export const FollowUpCandidate = {
  schema: FollowUpCandidateSchema,
  matchesPet: (candidate: FollowUpCandidate) =>
    candidate.appointment.petId === candidate.examResult.petId,
  needsPhoneCall: (candidate: FollowUpCandidate) =>
    Appointment.isPaid(candidate.appointment) && candidate.examResult.needsFollowUp,
} as const;

const FollowUpCandidatesSchema = z.array(FollowUpCandidate.schema);

export const FollowUpCandidates = {
  schema: FollowUpCandidatesSchema,
  parse: schemaResult(FollowUpCandidatesSchema),
} as const;
```

```typescript
const validateFollowUpCandidate = (
  candidate: FollowUpCandidate,
): Result<FollowUpCandidate, CollectFollowUpTargetsError> =>
  FollowUpCandidate.matchesPet(candidate)
    ? ok(candidate)
    : err({
        kind: "ExamResultPetMismatch",
        appointmentId: candidate.appointment.appointmentId,
        expectedPetId: candidate.appointment.petId,
        actualPetId: candidate.examResult.petId,
      });

const collectValidatedCandidates = (
  candidates: ReadonlyArray<FollowUpCandidate>,
): Result<ReadonlyArray<FollowUpCandidate>, CollectFollowUpTargetsError> =>
  candidates.reduce<Result<ReadonlyArray<FollowUpCandidate>, CollectFollowUpTargetsError>>(
    (result, candidate) =>
      result.andThen((items) =>
        validateFollowUpCandidate(candidate).map((validated) => [...items, validated]),
      ),
    ok([]),
  );

export const collectFollowUpTargets = (
  raw: unknown,
): Result<ReadonlyArray<FollowUpTarget>, CollectFollowUpTargetsError> =>
  FollowUpCandidates.parse(raw)
    .andThen(collectValidatedCandidates)
    .map((candidates) =>
      candidates
        .filter(FollowUpCandidate.needsPhoneCall)
        .reduce<ReadonlyArray<FollowUpCandidate>>(
          (unique, candidate) =>
            unique.some(({ appointment }) =>
              appointment.appointmentId === candidate.appointment.appointmentId,
            )
              ? unique
              : [...unique, candidate],
          [],
        )
        .map(FollowUpTarget.fromCandidate),
    );
```

`validateFollowUpCandidate` は ExamResult の pet ID と Appointment の pet ID が異なる場合、`ExamResultPetMismatch` を返します。side effect は validation 完了後も実行せず、event を return value に含めます。同じ appointment が複数回現れた場合は最初の一件だけを残し、`FollowUpRequested` を重複生成しません。

- [ ] **Step 7: final の検証**

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: PASS。状態、境界、Result、atomic save、PII、follow-up の全テストが成功します。

- [ ] **Step 8: Kamae 禁止パターンを確認**

Run: `rg --pcre2 -n "\\binterface\\b|\\bthrow new\\b|\\bas (?!const\\b)" examples/final/src --glob '*.ts'`

Expected: `schemaResult` の同期 schema 誤用を知らせる `throw new TypeError` 以外はヒットしません。

- [ ] **Step 9: final をコミット**

```bash
git add pnpm-lock.yaml examples/final
git commit -m "feat(examples): add complete Kamae clinic example"
```

### Task 8: ルートコマンドを example workspace へ切り替える

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `examples/session-00/package.json`
- Test: `examples/session-01/package.json`
- Test: `examples/session-02/package.json`
- Test: `examples/session-03/package.json`
- Test: `examples/session-04/package.json`
- Test: `examples/session-05/package.json`
- Test: `examples/final/package.json`

**Interfaces:**

- Consumes: Task 1 から Task 7 で作成した7 package。
- Produces: ルートの `build`、`test`、`typecheck` と `exercise:00` から `exercise:05` の新しい実行契約。

- [ ] **Step 1: ルート script の現行 filter が失敗することを確認**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: PASS。新 package が workspace として認識されていることを先に確認します。

Run: `rg -n "@fp-with-ts/clinic-example" package.json`

Expected: 現行の `build`、`test`、`typecheck`、`exercise:NN` が旧 package を参照しています。

- [ ] **Step 2: 通常コマンドを全 example 対象へ変更**

```json
{
  "scripts": {
    "dev": "pnpm --filter @fp-with-ts/docs dev",
    "build": "pnpm --filter './examples/*' build && pnpm --filter @fp-with-ts/docs build",
    "test": "pnpm --filter './examples/*' test && pnpm --filter @fp-with-ts/docs test",
    "exercise:00": "pnpm --filter @fp-with-ts/clinic-session-00 exercise",
    "exercise:01": "pnpm --filter @fp-with-ts/clinic-session-01 exercise",
    "exercise:02": "pnpm --filter @fp-with-ts/clinic-session-02 exercise",
    "exercise:03": "pnpm --filter @fp-with-ts/clinic-session-03 exercise",
    "exercise:04": "pnpm --filter @fp-with-ts/clinic-session-04 exercise",
    "exercise:05": "pnpm --filter @fp-with-ts/clinic-session-05 exercise",
    "typecheck": "pnpm --filter './examples/*' typecheck && pnpm --filter @fp-with-ts/docs typecheck && tsc -p worker/tsconfig.json --noEmit"
  }
}
```

既存の `preview`、`cf:dev`、`cf:deploy` は維持します。

- [ ] **Step 3: 通常コマンドの成功を確認**

Run: `pnpm typecheck`

Run: `pnpm test`

Expected: PASS。exercise を実行せず、7 example と docs/worker の通常契約が成功します。

- [ ] **Step 4: 各 exercise の失敗理由を確認**

次のコマンドを一つずつ実行します。

```bash
pnpm exercise:00
pnpm exercise:01
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
pnpm exercise:05
```

Expected:

- 00 は Paid を InExamination に戻せるため assertion が失敗します。
- 01 は state-modeling source が存在せず失敗します。
- 02 は boundary source が存在せず失敗します。
- 03 は Result/application source が存在せず失敗します。
- 04 は agent-review source が存在せず失敗します。
- 05 は collect-follow-up source が存在せず失敗します。

- [ ] **Step 5: ルート script をコミット**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: run clinic snapshots as workspace packages"
```

### Task 9: docs の module 語彙と route を session へ変更

**Files:**

- Create: `apps/docs/src/sessions/catalog.ts`
- Create: `apps/docs/src/sessions/catalog.test.ts`
- Delete: `apps/docs/src/modules/catalog.ts`
- Delete: `apps/docs/src/modules/catalog.test.ts`
- Create: `apps/docs/src/layouts/SessionLayout.astro`
- Create: `apps/docs/src/test/layouts/SessionLayout.test.ts`
- Delete: `apps/docs/src/layouts/ModuleLayout.astro`
- Delete: `apps/docs/src/test/layouts/ModuleLayout.test.ts`
- Create: `apps/docs/src/styles/sessions.css`
- Delete: `apps/docs/src/styles/modules.css`
- Create: `apps/docs/src/pages/sessions/00-break-the-app.astro`
- Create: `apps/docs/src/pages/sessions/00-read-the-incident.astro`
- Create: `apps/docs/src/pages/sessions/01-state-modeling.astro`
- Create: `apps/docs/src/pages/sessions/02-boundary-and-ids.astro`
- Create: `apps/docs/src/pages/sessions/03-result-errors.astro`
- Create: `apps/docs/src/pages/sessions/04-agent-review.astro`
- Create: `apps/docs/src/pages/sessions/05-mini-integration.astro`
- Delete: `apps/docs/src/pages/modules/00-break-the-app.astro`
- Delete: `apps/docs/src/pages/modules/00-read-the-incident.astro`
- Delete: `apps/docs/src/pages/modules/01-state-modeling.astro`
- Delete: `apps/docs/src/pages/modules/02-boundary-and-ids.astro`
- Delete: `apps/docs/src/pages/modules/03-result-errors.astro`
- Delete: `apps/docs/src/pages/modules/04-agent-review.astro`
- Delete: `apps/docs/src/pages/modules/05-mini-integration.astro`
- Create: `apps/docs/src/test/pages/sessions/session-00.test.ts`
- Create: `apps/docs/src/test/pages/sessions/sessions-01-02.test.ts`
- Create: `apps/docs/src/test/pages/sessions/sessions-03-04.test.ts`
- Create: `apps/docs/src/test/pages/sessions/session-05.test.ts`
- Delete: `apps/docs/src/test/pages/modules/module-00.test.ts`
- Delete: `apps/docs/src/test/pages/modules/modules-01-02.test.ts`
- Delete: `apps/docs/src/test/pages/modules/modules-03-04.test.ts`
- Delete: `apps/docs/src/test/pages/modules/module-05.test.ts`
- Modify: `apps/docs/src/pages/index.astro`
- Modify: `apps/docs/src/pages/404.astro`
- Modify: `apps/docs/src/test/pages/index.test.ts`
- Modify: `apps/docs/src/test/pages/site-contract.test.ts`
- Modify: `apps/docs/scripts/verify-static-build.mjs`

**Interfaces:**

- Consumes: 現行7ページの内容、TOC ID、前後ナビゲーション。
- Produces: `SessionSummary`、`sessions`、`sessionBySlug`、`sessionPath`、`sessionNeighbors`、`SessionLayout`、7個の `/sessions/...` route。

- [ ] **Step 1: session catalog の失敗するテストを追加**

```typescript
expect(sessions.map(({ slug }) => slug)).toEqual([
  "00-break-the-app",
  "00-read-the-incident",
  "01-state-modeling",
  "02-boundary-and-ids",
  "03-result-errors",
  "04-agent-review",
  "05-mini-integration",
]);
expect(sessionPath(sessions[2]!)).toBe("/sessions/01-state-modeling/");
expect(sessionNeighbors("01-state-modeling")).toEqual({
  previous: sessions[1],
  next: sessions[3],
});
```

`site-contract.test.ts` は `pages/sessions/*.astro` と catalog slug が一対一であることを検証します。index と 404 の test は `/sessions/00-break-the-app/` を期待します。

- [ ] **Step 2: 現行 module 実装でテストが失敗することを確認**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: FAIL。`src/sessions/catalog.ts` と session page が存在しません。

- [ ] **Step 3: catalog API を session 語彙で実装**

```typescript
export type SessionSummary = Readonly<{
  slug: string;
  sequence: "00-A" | "00-B" | "01" | "02" | "03" | "04" | "05";
  label: string;
  title: string;
  durationMinutes: number;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
}>;

export const sessionBySlug = (slug: string): SessionSummary | undefined =>
  sessions.find((session) => session.slug === slug);

export const sessionPath = (session: SessionSummary): string =>
  `/sessions/${session.slug}/`;

export const sessionNeighbors = (slug: string): Readonly<{
  previous?: SessionSummary;
  next?: SessionSummary;
}> => {
  const index = sessions.findIndex((session) => session.slug === slug);
  if (index < 0) return {};
  const previous = sessions[index - 1];
  const next = sessions[index + 1];
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
};
```

- [ ] **Step 4: layout、style、page route を session 語彙へ移す**

`SessionLayout.astro` の props は次に変更します。

```typescript
type Props = Readonly<{
  session: SessionSummary;
}>;
```

title、hero、TOC slots、previous/next の構造は維持し、`MODULE` 表示と CSS class の `module` を `SESSION` と `session` へ変更します。7ページの import、layout prop、unknown error message、catalog lookup を次の形へ統一します。

```astro
---
import SessionLayout from "../../layouts/SessionLayout.astro";
import { sessionBySlug } from "../../sessions/catalog";

const session = sessionBySlug("01-state-modeling");
if (session === undefined) throw new Error("Unknown session: 01-state-modeling");
---
```

各ページの `<ModuleLayout module={module}>` と閉じタグを `<SessionLayout session={session}>` へ変更します。本文、CodeBlock、CommandBlock、TOC ID はこの task では変更しません。

- [ ] **Step 5: static build の route allowlist を更新**

`verify-static-build.mjs` の required HTML を `sessions/00-*` から `sessions/05-*` の7件へ変更します。allowed internal paths は `/sessions/...` と既存 `/module-00/` を含め、`/modules/...` を除外します。

- [ ] **Step 6: docs の route 変更を検証**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS。7 session page が生成され、module page は生成されません。

- [ ] **Step 7: route rename をコミット**

```bash
git add apps/docs
git commit -m "refactor(docs): rename module routes to sessions"
```

### Task 10: docs を開始 package と final に対応させる

**Files:**

- Modify: `apps/docs/src/sessions/catalog.ts`
- Modify: `apps/docs/src/sessions/catalog.test.ts`
- Modify: `apps/docs/src/pages/sessions/00-break-the-app.astro`
- Modify: `apps/docs/src/pages/sessions/00-read-the-incident.astro`
- Modify: `apps/docs/src/pages/sessions/01-state-modeling.astro`
- Modify: `apps/docs/src/pages/sessions/02-boundary-and-ids.astro`
- Modify: `apps/docs/src/pages/sessions/03-result-errors.astro`
- Modify: `apps/docs/src/pages/sessions/04-agent-review.astro`
- Modify: `apps/docs/src/pages/sessions/05-mini-integration.astro`
- Create: `apps/docs/src/pages/sessions/final.astro`
- Modify: `apps/docs/src/test/pages/sessions/session-00.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/sessions-01-02.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/sessions-03-04.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/session-05.test.ts`
- Create: `apps/docs/src/test/pages/sessions/final.test.ts`
- Modify: `apps/docs/src/test/pages/site-contract.test.ts`
- Modify: `apps/docs/scripts/verify-static-build.mjs`

**Interfaces:**

- Consumes: 7 session packages と final package、Task 9 の session routes。
- Produces: 各ページと同番号 package の一対一対応、catalog 末尾の final、`/sessions/final/`。

- [ ] **Step 1: package 参照と final navigation の失敗するテストを追加**

各 page test は次の文字列を検証します。

```typescript
import { readFileSync } from "node:fs";

const readPage = (slug: string): string =>
  readFileSync(
    new URL(`../../../pages/sessions/${slug}.astro`, import.meta.url),
    "utf8",
  );

expect(readPage("00-break-the-app")).toContain("examples/session-00");
expect(readPage("00-read-the-incident")).toContain("examples/session-00");
expect(readPage("01-state-modeling")).toContain("examples/session-01");
expect(readPage("02-boundary-and-ids")).toContain("examples/session-02");
expect(readPage("03-result-errors")).toContain("examples/session-03");
expect(readPage("04-agent-review")).toContain("examples/session-04");
expect(readPage("05-mini-integration")).toContain("examples/session-05");
expect(readPage("final")).toContain("examples/final");
```

catalog test は final を末尾に追加し、Session 05 の next が final、final の previous が Session 05、final の next がないことを検証します。

- [ ] **Step 2: 旧 package 参照で失敗することを確認**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: FAIL。各ページが `packages/clinic-example` を参照し、final page が存在しません。

- [ ] **Step 3: catalog に final を追加**

`SessionSummary.sequence` に `"Final"` を追加します。final entry は次の値を使います。

```typescript
{
  slug: "final",
  sequence: "Final",
  label: "完成例",
  title: "Kamae に従う動物病院サンプル",
  durationMinutes: 10,
  animal: { name: "Mugi", type: "cat", avatar: "🐈" },
  summary: "全セッションの設計要素を統合した実装を確認します。",
}
```

- [ ] **Step 4: 各 session page の開始 package とコマンドを更新**

各ページの file path とコマンドを次へ統一します。

- 00-A: `examples/session-00/src/appointment.ts`、`pnpm exercise:00`
- 00-B: `examples/session-00/src/appointment.ts` と事故要件の整理、確認コマンドは `pnpm --filter @fp-with-ts/clinic-session-00 test`
- 01: `examples/session-01` の legacy/requirements と `pnpm exercise:01`
- 02: `examples/session-02/src/domain/appointment.ts` と `pnpm exercise:02`
- 03: `examples/session-03/src/domain/*`、boundary files と `pnpm exercise:03`
- 04: `examples/session-04/src/application/start-examination.ts`、dual-write review と `pnpm exercise:04`
- 05: `examples/session-05/src/application/start-examination.ts`、atomic store と `pnpm exercise:05`

red/green の green command は、同じ package を直接指定せず `pnpm --filter @fp-with-ts/clinic-session-NN test` を使います。本文中の Result assertion は custom `{ kind: "Ok" }` ではなく neverthrow の `isOk()`／`isErr()` に合わせます。

- [ ] **Step 5: final page を実装**

final page は次の4 section と TOC ID を持ちます。

- `final-structure`: 一概念一ファイルと package 構成。
- `final-flow`: unknown parse → Result pipeline → pure transition → atomic save。
- `final-follow-up`: declarative filter/map/reduce と PII。
- `final-verify`: `pnpm --filter @fp-with-ts/clinic-final typecheck` と test。

CodeBlock は `Appointment` companion、`startExaminationUseCase`、`collectFollowUpTargets` の実ファイルと一致する抜粋を表示します。

- [ ] **Step 6: final を static build 契約へ追加**

`sessions/final/index.html` を required HTML と allowed internal path に追加します。site contract は8ページと8 catalog entry の一対一対応を検証します。

- [ ] **Step 7: docs 内容の検証**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS。8ページが生成され、Session 05 から final へ遷移できます。

- [ ] **Step 8: docs の文章スタイルを検査**

Run: `rg -n "(上界|表化|織り込|達成目標|設計の天井|に倒れる|として乗る|硬化|の鍵|羅針盤|銀の弾丸|（[A-Za-z][^）]*）)" apps/docs/src/pages/sessions`

Run: `rg -n "(である|であった|だった|ではない|だ)。" apps/docs/src/pages/sessions`

Run: `rg -n "(来週|先週|今週|来月|先月|今月|昨日|明日|本日|今日|先スプリント|今スプリント|来スプリント|今期|今四半期|来四半期)" apps/docs/src/pages/sessions`

Expected: 禁止表現、地の文の常体、相対日付がヒットしません。コードブロック内の意図的な文字列は目視で除外します。

- [ ] **Step 9: docs の package 対応をコミット**

```bash
git add apps/docs
git commit -m "docs: align sessions with starting snapshots"
```

### Task 11: Worker・運営資料・旧 package の移行完了

**Files:**

- Modify: `worker/routes.ts`
- Modify: `worker/routes.test.ts`
- Modify: `worker/index.test.ts`
- Modify: `docs/event/facilitator-guide.md`
- Modify: `README.md`
- Delete: `packages/clinic-example/README.md`
- Delete: `packages/clinic-example/package.json`
- Delete: `packages/clinic-example/tsconfig.json`
- Delete: `packages/clinic-example/vitest.config.ts`
- Delete: `packages/clinic-example/vitest.exercises.config.ts`
- Delete: `packages/clinic-example/src/legacy/appointment.ts`
- Delete: `packages/clinic-example/src/legacy/logger.ts`
- Delete: `packages/clinic-example/src/shared/assert-never.ts`
- Delete: `packages/clinic-example/src/shared/result.ts`
- Delete: `packages/clinic-example/src/shared/schema-result.ts`
- Delete: `packages/clinic-example/src/shared/sensitive.ts`
- Delete: `packages/clinic-example/src/clinic/agent-review.ts`
- Delete: `packages/clinic-example/src/clinic/appointment-id.ts`
- Delete: `packages/clinic-example/src/clinic/appointment-repository.ts`
- Delete: `packages/clinic-example/src/clinic/appointment.ts`
- Delete: `packages/clinic-example/src/clinic/domain-event-store.ts`
- Delete: `packages/clinic-example/src/clinic/domain-events.ts`
- Delete: `packages/clinic-example/src/clinic/exam-result.ts`
- Delete: `packages/clinic-example/src/clinic/owner-contact.ts`
- Delete: `packages/clinic-example/src/clinic/owner-id.ts`
- Delete: `packages/clinic-example/src/clinic/pet-id.ts`
- Delete: `packages/clinic-example/src/clinic/use-cases.ts`
- Delete: `packages/clinic-example/src/clinic/veterinarian-id.ts`
- Delete: `packages/clinic-example/test/00-setup.test.ts`
- Delete: `packages/clinic-example/test/01-state-modeling.test.ts`
- Delete: `packages/clinic-example/test/02-boundary-and-ids.test.ts`
- Delete: `packages/clinic-example/test/03-result-errors.test.ts`
- Delete: `packages/clinic-example/test/04-agent-review.test.ts`
- Delete: `packages/clinic-example/test/05-follow-up.test.ts`
- Delete: `packages/clinic-example/exercises/00-incident.test.ts`
- Delete: `packages/clinic-example/exercises/01-state-modeling.test.ts`
- Delete: `packages/clinic-example/exercises/02-boundary-and-ids.test.ts`
- Delete: `packages/clinic-example/exercises/03-result-errors.test.ts`
- Delete: `packages/clinic-example/exercises/04-agent-review.test.ts`
- Delete: `packages/clinic-example/exercises/05-follow-up.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: 新しい `/sessions/...` routes、全 example package、更新済み root scripts。
- Produces: `/module-00` から新 Session 00 への互換 redirect、運営資料の新コマンド、旧 package のない最終 workspace。

- [ ] **Step 1: Worker route の失敗する期待値へ変更**

```typescript
expect(resolveRoute(new URL("https://example.test/module-00"))).toEqual({
  kind: "redirect",
  location: "/sessions/00-break-the-app/",
  status: 308,
});

expect(resolveRoute(new URL("https://example.test/sessions/01-state-modeling/"))).toEqual({
  kind: "asset",
});
```

`worker/index.test.ts` の完全 URL と asset fixture も `/sessions/...` へ変更します。

- [ ] **Step 2: Worker テストの失敗を確認**

Run: `pnpm --filter @fp-with-ts/docs test -- ../../worker/routes.test.ts ../../worker/index.test.ts`

Expected: FAIL。redirect 先と fixture がまだ `/modules/...` です。

- [ ] **Step 3: Worker route を更新**

`/module-00` と `/module-00/` の alias は残し、location を `/sessions/00-break-the-app/` へ変更します。`/sessions/...` は通常 asset route として扱います。旧 `/modules/...` 用の redirect は追加しません。

- [ ] **Step 4: README と facilitator guide を更新**

README に `examples/session-00` から `examples/final` の意味、通常 test と exercise の違い、開始方法を追加します。facilitator guide の `@fp-with-ts/clinic-example exercise:04` は `pnpm exercise:04` へ変更します。

- [ ] **Step 5: 旧 package を削除して lockfile を更新**

`packages/clinic-example` の全 tracked file を削除します。空になったディレクトリは Git の管理対象外になります。

Run: `pnpm install --no-frozen-lockfile`

Expected: `pnpm-lock.yaml` から `packages/clinic-example` importer が消え、7 example importer が残ります。

- [ ] **Step 6: 旧参照が残っていないことを確認**

Run: `rg -n "packages/clinic-example|@fp-with-ts/clinic-example|/modules/" --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**' .`

Expected: 移行対象の source、config、現行 docs にはヒットしません。Git 履歴を説明するファイルは対象外です。

- [ ] **Step 7: 全検証を実行**

Run: `pnpm typecheck`

Expected: PASS。全 example、Astro、Worker に型エラーがありません。

Run: `pnpm test`

Expected: PASS。全 example の通常テスト、docs、Worker の全テストが成功します。

Run: `pnpm build`

Expected: PASS。8個の session/final page を含む静的 build が検証されます。

Run: `git diff --check`

Expected: 出力なし。

- [ ] **Step 8: exercise の意図的な失敗を再確認**

`pnpm exercise:00` から `pnpm exercise:05` を一つずつ実行し、Task 8 Step 4 と同じ失敗理由であることを確認します。別の import error、syntax error、設定エラーで失敗した場合は修正します。

- [ ] **Step 9: 移行完了をコミット**

```bash
git add README.md docs/event/facilitator-guide.md worker pnpm-lock.yaml
git add -A packages/clinic-example
git commit -m "refactor: replace clinic package with session snapshots"
```

### Task 12: 最終レビューと完了証跡

**Files:**

- Review: `docs/superpowers/specs/2026-08-06-clinic-session-examples-design.md`
- Review: `examples/session-00` から `examples/final`
- Review: `apps/docs/src/pages/sessions`
- Review: `package.json`
- Review: `pnpm-workspace.yaml`

**Interfaces:**

- Consumes: Task 1 から Task 11 の全成果物。
- Produces: 仕様要件と検証結果の対応表。コード変更は原則として行いません。

- [ ] **Step 1: 仕様の完了条件を一つずつ照合**

次を確認します。

- `packages/clinic-example` が存在しません。
- `examples/session-00` から `session-05` と `examples/final` が存在します。
- 各 page が同じ番号の開始 package を参照します。
- final は Zod、neverthrow、atomic save、PII inspect、宣言的 follow-up を使います。
- 通常検証は成功し、exercise は想定した理由だけで失敗します。
- `/modules/...` route は生成されず、`/module-00` alias は新 route へ redirect します。

- [ ] **Step 2: final の adversarial check**

Run: `rg -n "\\binterface\\b|\\bfor \\(|\\.push\\(|\\bas " examples/final/src --glob '*.ts'`

Expected: `as const` 以外の assertion、interface、命令的 loop、mutable push がありません。

Run: `rg -n "console\\.|JSON.stringify\\(|logger\\." examples/final/src --glob '*.ts'`

Expected: PII を直接出力する処理がありません。JSON serialization を使う場合は Sensitive の mask test で保護されています。

- [ ] **Step 3: clean status と commit 列を確認**

Run: `git status --short --branch`

Run: `git log --oneline -12`

Expected: worktree が clean で、設計、各 snapshot、docs route、docs 内容、移行完了が意味ごとの commit に分かれています。
