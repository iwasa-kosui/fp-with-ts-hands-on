# Session 00 Unimproved SQLite Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session 00を、後続セッションの改善を適用していないSQLite永続化済みの現行システムへ作り替え、8つの事故をブラウザから再現できるようにします。

**Architecture:** ソースの相対パスはSession 02以降へ揃えますが、予約は任意の状態文字列とoptional fieldを持つ一つのJSONとして扱います。Finalと同じbetter-sqlite3、Drizzle ORM、SQL migrationを使い、状態更新と監査追加は意図的に別々のSQLとして保存します。共通のClinicDashboardへoptionalな事故再現パネルを加え、Session 00だけがDB内容と事故操作を渡します。

**Tech Stack:** TypeScript 5.9、Hono、Inertia、React 19、Vitest、better-sqlite3、Drizzle ORM、Vite、pnpm

**Spec:** `docs/superpowers/specs/2026-08-29-session-00-unimproved-sqlite-baseline-design.md`

## Global Constraints

- `examples/session-00/src/legacy` と `Legacy` 接頭辞を残しません。
- Session 02からSession 07の実装は変更しません。
- SQL文字列連結と未加工HTML出力は追加しません。
- 意図的な欠陥はテスト名と教材本文で未改善の振る舞いだと明示します。
- 開発DB `examples/session-00/clinic.sqlite` はGit管理しません。
- すべてのproduction codeは、対応するテストが期待どおり失敗した後に実装します。

---

### Task 1: 共通ダッシュボードへ事故再現パネルを追加する

**Files:**
- Modify: `packages/clinic-web/src/contracts.ts`
- Modify: `packages/clinic-web/src/ClinicDashboard.tsx`
- Modify: `packages/clinic-web/src/index.ts`
- Modify: `packages/clinic-web/src/styles.css`
- Modify: `packages/clinic-web/test/ClinicDashboard.test.tsx`

**Interfaces:**
- Produces: `IncidentLab`, `IncidentScenario`, `DatabaseInspection`
- Produces: `ClinicPageProps.incidentLab?: IncidentLab`
- Preserves: `incidentLab` を渡さないSession 02からSession 07の描画結果

- [ ] **Step 1: optionalな事故再現propsの描画テストを書く**

`packages/clinic-web/test/ClinicDashboard.test.tsx` に、次のpropsを渡した場合だけ事故再現領域、操作説明、DB JSON、不整合警告が出るテストを追加します。

```tsx
incidentLab: {
  scenarios: [{
    title: "未知の状態を保存する",
    description: "statusへ定義されていない文字列を保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/unknown-status",
      method: "post",
    },
  }],
  inspection: {
    appointmentJson: '{"status":"waiting-for-magic"}',
    auditLogJson: '[{"eventName":"appointment.updated"}]',
    warnings: ["未知の状態が保存されています"],
  },
}
```

既存の `props` では「事故再現」と「DBに保存された予約」が描画されないことも同じテストファイルで確認します。

- [ ] **Step 2: 共通UIテストが型または描画不足で失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-web test -- ClinicDashboard.test.tsx`

Expected: `incidentLab` が `ClinicPageProps` に存在しないか、事故再現見出しが見つからずFAILします。

- [ ] **Step 3: 事故再現用の契約と表示を実装する**

`contracts.ts` に次の型を追加します。

```ts
export type IncidentScenario = Readonly<{
  title: string;
  description: string;
  action: Exclude<ActionAvailability, { kind: "Hidden" }>;
}>;

export type DatabaseInspection = Readonly<{
  appointmentJson: string;
  auditLogJson: string;
  warnings: readonly string[];
}>;

export type IncidentLab = Readonly<{
  scenarios: readonly IncidentScenario[];
  inspection: DatabaseInspection;
}>;
```

`ClinicPageProps` へ `incidentLab?: IncidentLab` を追加します。`ClinicDashboard.tsx` は値がある場合だけ次を描画します。

- 「事故再現」見出しとシナリオごとの説明・実行ボタン
- 「DBに保存された予約」と「DBに保存された監査ログ」の `<pre>`
- `warnings` の箇条書き

既存の `ActionButton` を再利用し、JSON文字列はReactのテキストノードとして描画します。`index.ts` から3つの新しい型もexportします。

- [ ] **Step 4: 共通UIのtestとtypecheckを実行する**

Run: `pnpm --filter @fp-with-ts/clinic-web test`

Run: `pnpm --filter @fp-with-ts/clinic-web typecheck`

Expected: 全テスト成功、型エラー0件です。

- [ ] **Step 5: 共通UI変更をコミットする**

```bash
git add packages/clinic-web
git commit -m "feat(clinic-web): 事故再現とDB状態の表示領域を追加"
```

### Task 2: Session 00へSQLite runtimeとmigrationを追加する

**Files:**
- Modify: `.gitignore`
- Modify: `examples/session-00/package.json`
- Modify: `examples/session-00/tsconfig.json`
- Modify: `examples/session-00/vite.config.ts`
- Create: `examples/session-00/drizzle.config.ts`
- Create: `examples/session-00/drizzle/0000_initial.sql`
- Create: `examples/session-00/drizzle/meta/_journal.json`
- Create: `examples/session-00/src/adaptor/secondary/sqlite/schema.ts`
- Create: `examples/session-00/src/adaptor/secondary/sqlite/db.ts`
- Create: `examples/session-00/test/adaptor/sqliteRuntime.test.ts`
- Modify: `packages/clinic-web/src/viteConfig.ts`
- Modify: `packages/clinic-web/test/runtime.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `SqliteDatabase`
- Produces: `createSqliteDatabase(path: string): SqliteDatabase`
- Produces: `migrateDatabase(db: SqliteDatabase, folder?: string): void`
- Produces: `appointmentsTable`, `auditLogsTable`, `sqliteSchema`
- Extends: `createClinicViteConfig({ external?: readonly string[] })`

- [ ] **Step 1: migrationとVite external設定の失敗テストを書く**

`sqliteRuntime.test.ts` は `:memory:` DBへmigrationを2回適用し、`appointments`、`audit_logs`、`__drizzle_migrations` が存在することを確認します。

```ts
expect(
  database
    .all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .map(({ name }) => name),
).toEqual(expect.arrayContaining([
  "__drizzle_migrations",
  "appointments",
  "audit_logs",
]));
```

`packages/clinic-web/test/runtime.test.ts` には次を追加します。

```ts
const config = createClinicViteConfig({ external: ["better-sqlite3"] });
expect(config).toBeTypeOf("function");
if (typeof config !== "function") throw new TypeError("config must be a function");
const resolved = await config({
  command: "build",
  isPreview: false,
  isSsrBuild: true,
  mode: "server",
});
expect(resolved.ssr?.external).toEqual(["better-sqlite3"]);
```

- [ ] **Step 2: DB moduleとVite optionが存在せず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-web test -- runtime.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- sqliteRuntime.test.ts`

Expected: `db.ts` のmodule解決または `createClinicViteConfig` の引数でFAILします。

- [ ] **Step 3: package、schema、migration、DB生成処理を実装する**

Session 00へ次の依存をFinalと同じversion rangeで追加します。

```json
{
  "dependencies": {
    "better-sqlite3": "^11.9.1",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "drizzle-kit": "^0.31.10"
  }
}
```

`package.json` へ `db:generate` と `db:migrate` を追加し、`tsconfig.json` のincludeへ `drizzle.config.ts` を加えます。

`schema.ts` は次の列を定義します。

```ts
export const appointmentsTable = sqliteTable("appointments", {
  appointmentId: text("appointment_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  petId: text("pet_id").notNull(),
  status: text("status").notNull(),
  state: text("state", { mode: "json" }).notNull(),
});

export const auditLogsTable = sqliteTable("audit_logs", {
  eventId: text("event_id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  eventName: text("event_name").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  occurredAt: text("occurred_at").notNull(),
});
```

`drizzle.config.ts` はSession 00自身のschema、migration出力先、開発DBを指定します。

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/adaptor/secondary/sqlite/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./clinic.sqlite" },
});
```

`drizzle/meta/_journal.json` は `0000_initial` をidx 0として登録します。

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [{
    "idx": 0,
    "version": "6",
    "when": 1787932800000,
    "tag": "0000_initial",
    "breakpoints": true
  }]
}
```

SQL migrationは次の2テーブルを作ります。外部キーと状態CHECK制約は追加しません。

```sql
CREATE TABLE `appointments` (
  `appointment_id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `pet_id` text NOT NULL,
  `status` text NOT NULL,
  `state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
  `event_id` text PRIMARY KEY NOT NULL,
  `appointment_id` text NOT NULL,
  `event_name` text NOT NULL,
  `payload` text NOT NULL,
  `occurred_at` text NOT NULL
);
```

`db.ts` はFinalと同じbetter-sqlite3用Drizzle driverとmigratorを使います。

`.gitignore` へ `/examples/session-00/clinic.sqlite` とSQLiteの `-shm`、`-wal` を追加します。`createClinicViteConfig` はoptionの `external` をserver build pluginと `ssr.external` へ渡し、Session 00のVite configから `better-sqlite3` を指定します。

- [ ] **Step 4: lockfileを更新してDB runtimeテストを通す**

Run: `pnpm install`

Run: `pnpm --filter @fp-with-ts/clinic-web test -- runtime.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- sqliteRuntime.test.ts`

Expected: migrationは2回とも成功し、3テーブルが存在します。Vite server buildはbetter-sqlite3をexternalとして扱います。

- [ ] **Step 5: SQLite基盤をコミットする**

```bash
git add .gitignore pnpm-lock.yaml packages/clinic-web examples/session-00
git commit -m "feat(session-00): SQLite永続化の基盤を追加"
```

### Task 3: 未改善の予約モデルと入力境界を同じ相対パスへ置く

**Files:**
- Create: `examples/session-00/src/domain/appointment/appointment.ts`
- Create: `examples/session-00/src/domain/appointment/statusLabel.ts`
- Create: `examples/session-00/src/boundary/examResult.ts`
- Replace: `examples/session-00/test/setup.test.ts`

**Interfaces:**
- Produces: `Appointment`, `AppointmentExtra`, `BookAppointmentInput`, `ExamResult`
- Produces: `bookAppointment(input): Appointment`
- Produces: `updateStatus(appointment, status, extra?): Appointment`
- Produces: `ExamResult.parse(raw: any): ExamResult`
- Produces: `toStatusLabel(appointment): string`

- [ ] **Step 1: 未改善の振る舞いを固定するテストを書く**

`setup.test.ts` に次を別々のテストとして追加します。

```ts
it("未改善の現行システムが会計済みを診察中へ戻してしまう", () => {
  const paid = updateStatus(bookAppointment(input), "paid", { amount: 4800 });
  expect(updateStatus(paid, "in-examination").status).toBe("in-examination");
});

it("未改善の現行システムが未知の状態とID取り違えを受け入れてしまう", () => {
  const appointment = updateStatus(bookAppointment(input), "waiting-for-magic", {
    petId: input.ownerId,
  });
  expect(appointment).toMatchObject({
    status: "waiting-for-magic",
    petId: input.ownerId,
  });
});

it("名前だけの入力境界が不正な検査結果を受け入れてしまう", () => {
  expect(ExamResult.parse({ items: "not-an-array" })).toEqual({
    items: "not-an-array",
  });
});
```

- [ ] **Step 2: 新しいmoduleが存在せず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- setup.test.ts`

Expected: `src/domain/appointment/appointment.ts` または `src/boundary/examResult.ts` を解決できずFAILします。

- [ ] **Step 3: wide型、任意状態、未検証parseを実装する**

`Appointment` は次の形を基準にし、診察・検査・会計・キャンセルの値をoptionalにします。

```ts
export type Appointment = Readonly<{
  appointmentId: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  scheduledAt: string;
  reason: string;
  status: string;
  checkedInAt?: string;
  veterinarianId?: string;
  examinationStartedAt?: string;
  examId?: string;
  examinationCompletedAt?: string;
  diagnosis?: unknown;
  treatment?: unknown;
  items?: unknown;
  amount?: unknown;
  paidAt?: string;
  cancelReason?: string;
}>;
```

`AppointmentExtra` は `Partial<Omit<Appointment, "appointmentId">>` とし、`updateStatus` は `{ ...appointment, ...extra, status }` を返します。`ExamResult.parse` は `raw: any` をそのまま返します。status labelは既知状態の `Record<string, string>` と `appointment.status` fallbackで実装します。

```ts
export type ExamResult = any;

export const ExamResult = {
  parse: (raw: any): ExamResult => raw,
} as const;
```

- [ ] **Step 4: Session 00のtestとtypecheckを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- setup.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Expected: 未改善の3振る舞いがすべて明示的に成功します。既存Web routeはTask 6で新しいmodelとstoreへ切り替えるまで動作を維持します。

- [ ] **Step 5: モデルと境界の配置変更をコミットする**

```bash
git add examples/session-00
git commit -m "feat(session-00): 後続セッションと比較する未改善モデルを追加"
```

### Task 4: PII監査と非原子的保存を行うSQLite storeを追加する

**Files:**
- Create: `examples/session-00/src/adaptor/secondary/sqlite/appointmentStore.ts`
- Create: `examples/session-00/test/adaptor/appointmentStore.test.ts`

**Interfaces:**
- Produces: `AuditLog`
- Produces: `AppointmentStore`
- Produces: `createAppointmentStore(db): AppointmentStore`
- `AppointmentStore`: `find`, `save`, `appendAudit`, `listAuditLogs`, `reset`, `seedIfEmpty`
- Exposes: `RESERVED_AUDIT_EVENT_ID` for the deterministic audit failure scenario

- [ ] **Step 1: 永続化とPII漏えいを表す失敗テストを書く**

`appointmentStore.test.ts` はmigration済みDBを使い、次を確認します。

```ts
store.reset(initialAppointment);
const updated = updateStatus(store.find(initialAppointment.appointmentId)!, "paid", {
  amount: 4800,
});
store.save(updated);
store.appendAudit({
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventName: "appointment.updated",
  occurredAt: "2026-08-30T07:10:00.000Z",
  appointment: updated,
});

expect(store.find(updated.appointmentId)).toEqual(updated);
expect(JSON.stringify(store.listAuditLogs())).toContain(initialAppointment.ownerEmail);
expect(JSON.stringify(store.listAuditLogs())).toContain(initialAppointment.ownerPhone);
```

別テストで `appointmentsTable.state` を直接不正JSON objectへ更新し、`find` が検証せず `Appointment` として返すことを確認します。

- [ ] **Step 2: store moduleがなく失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- appointmentStore.test.ts`

Expected: `appointmentStore.ts` を解決できずFAILします。

- [ ] **Step 3: トランザクションを使わないsaveとappendAuditを実装する**

`save` はappointmentsをupsertし、`appendAudit` は別メソッドでaudit_logsへinsertします。両方をまとめるメソッドは作りません。

```ts
save: (appointment) => {
  db.insert(appointmentsTable)
    .values(toAppointmentRow(appointment))
    .onConflictDoUpdate({
      target: appointmentsTable.appointmentId,
      set: toAppointmentRow(appointment),
    })
    .run();
},
appendAudit: ({ appointment, ...event }) => {
  db.insert(auditLogsTable)
    .values({ ...event, appointmentId: appointment.appointmentId, payload: appointment })
    .run();
},
```

`find` はDBの `state` を検証せず `as Appointment` で返します。`listAuditLogs` はSQLiteのrowid順で返し、配列末尾を最後に追加した監査として扱えるようにします。`reset` だけはデモを再実行できるようにtransaction内で両テーブルを削除し、初期予約とPIIを含む初期監査を保存します。初期監査のIDには `RESERVED_AUDIT_EVENT_ID` を使います。

- [ ] **Step 4: store testとtypecheckを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- appointmentStore.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Expected: DBから予約と監査を読めて、監査JSONに氏名・メール・電話が残ります。不正なstateも例外なく返ります。

- [ ] **Step 5: 未改善SQLite storeをコミットする**

```bash
git add examples/session-00
git commit -m "feat(session-00): PII監査と非原子的な予約保存を再現"
```

### Task 5: 直接時刻・ID生成と監査欠落をuse caseで再現する

**Files:**
- Create: `examples/session-00/src/useCase/startExamination.ts`
- Create: `examples/session-00/test/useCase/startExamination.test.ts`

**Interfaces:**
- Consumes: `AppointmentStore`, `RESERVED_AUDIT_EVENT_ID`, `updateStatus`
- Produces: `startExamination(store)(input): Appointment`
- Produces: `startExaminationWithAuditFailure(store)(input): Appointment`

- [ ] **Step 1: hidden nondeterminismとpartial writeの失敗テストを書く**

通常の診察開始を2回実行し、保存された監査event IDが異なることを確認します。監査失敗用関数は例外を投げますが、予約だけが診察中へ変わることを確認します。

```ts
const first = startExamination(store)(input);
const second = startExamination(store)(input);
expect(store.listAuditLogs().slice(-2).map(({ eventId }) => eventId)[0])
  .not.toBe(store.listAuditLogs().slice(-2).map(({ eventId }) => eventId)[1]);
expect(first.status).toBe("in-examination");
expect(second.status).toBe("in-examination");

store.reset(initialAppointment);
expect(() => startExaminationWithAuditFailure(store)(input)).toThrow();
expect(store.find(input.appointmentId)?.status).toBe("in-examination");
expect(store.listAuditLogs()).toHaveLength(1);
```

存在しないIDでは `Appointment not found: <id>` を含む `Error` がthrowされるテストも追加します。

- [ ] **Step 2: use case moduleがなく失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- startExamination.test.ts`

Expected: module解決でFAILします。

- [ ] **Step 3: new DateとrandomUUIDを直接使うdual-writeを実装する**

```ts
const run = (store: AppointmentStore, eventId: string) => (input: Input) => {
  const current = store.find(input.appointmentId);
  if (current === undefined) {
    throw new Error(`Appointment not found: ${input.appointmentId}`);
  }
  const occurredAt = new Date().toISOString();
  const updated = updateStatus(current, "in-examination", {
    veterinarianId: input.veterinarianId,
    examinationStartedAt: occurredAt,
  });
  store.save(updated);
  store.appendAudit({
    eventId,
    eventName: "examination.started",
    occurredAt,
    appointment: updated,
  });
  return updated;
};

export const startExamination = (store: AppointmentStore) =>
  (input: Input) => run(store, randomUUID())(input);
```

監査失敗用関数は `RESERVED_AUDIT_EVENT_ID` を使い、予約保存後のaudit insertを一意制約違反にします。状態検査、Result、Clock、EventIdGenerator、transactionは追加しません。

- [ ] **Step 4: use caseとSession 00 testを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- startExamination.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Expected: 通常操作は異なるIDを残し、失敗操作はthrowして予約だけを更新します。

- [ ] **Step 5: 未改善use caseをコミットする**

```bash
git add examples/session-00
git commit -m "feat(session-00): 非決定値と監査欠落を診察開始で再現"
```

### Task 6: 8つの事故をWeb routeとDB inspectionへ接続する

**Files:**
- Delete: `examples/session-00/src/legacy/appointment.ts`
- Delete: `examples/session-00/src/legacy/logger.ts`
- Create: `examples/session-00/src/web/appointmentView.ts`
- Replace: `examples/session-00/src/web/routes.ts`
- Modify: `examples/session-00/src/app.ts`
- Replace: `examples/session-00/test/web/clinicFlow.test.ts`

**Interfaces:**
- Consumes: `AppointmentStore`, `ExamResult`, `startExamination`, `startExaminationWithAuditFailure`
- Produces: `toPageProps(appointment, auditLogs, notice): ClinicPageProps`
- Produces: `registerClinicRoutes(app, store): void`
- Changes: `createApp(database, isProduction?): Hono`

- [ ] **Step 1: 事故routeとinspection propsの失敗テストを書く**

各テストはmigration済みの新しいin-memory DBからappを作ります。通常フローの後に会計済みから診察中へ戻る既存テストを維持し、次を追加します。

```ts
await post(app, "/demo/incidents/unknown-status");
expect((await page(app)).props.incidentLab.inspection.appointmentJson)
  .toContain('\"status\": \"waiting-for-magic\"');

await post(app, "/demo/reset");
await post(app, "/demo/incidents/swap-identifiers");
expect((await page(app)).props.incidentLab.inspection.appointmentJson)
  .toContain(`\"petId\": \"${clinicFixture.ownerId}\"`);

await post(app, "/demo/reset");
await post(app, "/demo/incidents/malformed-exam-result");
expect((await page(app)).props.incidentLab.inspection.appointmentJson)
  .toContain('\"items\": \"not-an-array\"');
```

存在しない予約の事故routeは `/?notice=invalid-state` へredirectすることを確認します。監査失敗routeは固定noticeへredirectした後、page propsの予約statusが `in-examination`、最新監査payloadのstatusが `scheduled`、warningsに監査欠落が含まれることを確認します。page propsの `auditLogJson` にownerEmailとownerPhoneが含まれることも確認します。

- [ ] **Step 2: 新しいapp signatureと事故routeがなく失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- clinicFlow.test.ts`

Expected: `createApp(database)` の型、事故routeの404、または `incidentLab` の欠落でFAILします。

- [ ] **Step 3: appointmentViewと全操作がAvailableな画面propsを実装する**

`appointmentView.ts` は受付、診察開始、診察結果、会計、キャンセルを全状態で `Available` として返します。電話フォローは今回の事故対象に含めないため、現在どおり `NotImplemented` とします。`incidentLab.scenarios` は次のrouteへ接続します。

```text
POST /demo/incidents/unknown-status
POST /demo/incidents/swap-identifiers
POST /demo/incidents/malformed-exam-result
POST /demo/incidents/missing-appointment
POST /demo/incidents/repeat-start-examination
POST /demo/incidents/audit-failure
```

通常操作と上記6操作を組み合わせて、設計書の8つの観察項目を満たします。`inspection` は予約と監査配列を整形したJSON文字列にし、次のwarningsを計算します。

- statusが既知の6状態に含まれない
- ownerIdとpetIdが同じ値になっている
- 最新監査payloadのstatusと予約statusが異なる
- 監査payloadにownerEmailまたはownerPhoneがある

- [ ] **Step 4: routeへ未改善処理と固定事故入力を接続する**

標準routeは `store.find`、`updateStatus`、`store.save`、`store.appendAudit` を直接組み合わせます。`exam-results` と `malformed-exam-result` は `ExamResult.parse(raw)` の値を検証せず保存します。

`missing-appointment` は存在しないIDで `startExamination` を呼び、catch内の `error.message.includes("Appointment not found")` で判定しながら `/?notice=invalid-state` へ誤分類します。`audit-failure` は監査の一意制約違反をcatchし、`/?notice=conflict` へredirectします。例外本文とDBエラーはresponseへ含めません。

`POST /demo/reset` はstoreの `reset(initialAppointment)` を呼びます。`createApp` は渡されたDBからstoreを作り、`seedIfEmpty` だけを実行します。

routeを新しいmodelとstoreへ切り替えた後、`src/legacy/appointment.ts` と `src/legacy/logger.ts` を削除し、`src/legacy` へのimportが0件になっていることを `rg -n "src/legacy|../legacy" examples/session-00` で確認します。

- [ ] **Step 5: Web test、Session 00 test、typecheckを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Expected: 全事故route、通常フロー、500境界、resetが成功します。

- [ ] **Step 6: Web事故再現をコミットする**

```bash
git add examples/session-00
git commit -m "feat(session-00): 未改善な業務事故をブラウザ操作へ接続"
```

### Task 7: ファイルSQLiteを起動経路へ接続する

**Files:**
- Modify: `examples/session-00/src/app.ts`
- Modify: `examples/session-00/src/server.ts`
- Create: `examples/session-00/test/integration/fileSqliteSmoke.test.ts`

**Interfaces:**
- Produces: `createDatabaseBackedApp({ databasePath, migrationsFolder, isProduction })`
- Preserves: `createApp(database, isProduction)` for in-memory web tests

- [ ] **Step 1: 再起動後も予約を復元するfile DBテストを書く**

一時ディレクトリにDBを作り、最初のappで未知状態を保存します。別のDB接続と新しいappを作り、GET `/` のpropsに同じ未知状態と監査ログが残ることを確認します。

```ts
const directory = mkdtempSync(join(tmpdir(), "clinic-session-00-"));
const options = {
  databasePath: join(directory, "clinic.sqlite"),
  migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  isProduction: false,
} as const;
const headers = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;
const post = (app: ReturnType<typeof createDatabaseBackedApp>, path: string) =>
  app.request(path, { method: "POST", headers });
const page = async (app: ReturnType<typeof createDatabaseBackedApp>) =>
  (await app.request("/", { headers })).json();

const first = createDatabaseBackedApp(options);
await post(first, "/demo/incidents/unknown-status");

const second = createDatabaseBackedApp(options);
expect(await page(second)).toMatchObject({
  props: {
    appointment: { kind: "waiting-for-magic" },
  },
});
```

DBファイルが存在すること、migrationを再実行しても既存予約をresetしないことも確認します。

- [ ] **Step 2: database-backed factoryがなく失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- fileSqliteSmoke.test.ts`

Expected: `createDatabaseBackedApp` が存在せずFAILします。

- [ ] **Step 3: serverとdatabase-backed factoryを実装する**

`createDatabaseBackedApp` はDBを開き、migrationを適用し、`createApp` を返します。`server.ts` は次の固定パスを使います。

```ts
const app = createDatabaseBackedApp({
  databasePath: fileURLToPath(new URL("../clinic.sqlite", import.meta.url)),
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  isProduction: import.meta.env.PROD,
});
```

factoryとserverのどちらも既存データをresetしません。

- [ ] **Step 4: file DB test、build、typecheckを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test -- fileSqliteSmoke.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 build`

Expected: 一時ファイルへ状態が残り、server buildがbetter-sqlite3をexternalとして完了します。

- [ ] **Step 5: ファイル永続化をコミットする**

```bash
git add examples/session-00
git commit -m "feat(session-00): デモ状態をファイルSQLiteへ永続化"
```

### Task 8: READMEと公開Session 00を新しい観察対象へ同期する

**Files:**
- Modify: `examples/session-00/README.md`
- Modify: `apps/docs/src/pages/sessions/00-system-handover.astro`
- Modify: `apps/docs/src/code-explorer/code-guides/code-guides.test.ts`
- Modify: `apps/docs/src/session-contracts.test.ts`

**Interfaces:**
- Consumes: 実装後の正確なソースパスと行番号
- Produces: 8つのsource-backed `CodeGuide`
- Removes: `src/legacy` と `legacy` を前提とする公開文言

- [ ] **Step 1: 公開教材の契約テストを先に更新する**

`code-guides.test.ts` のSession 00上限を8件へ変更し、次のguide IDとsource fragmentを登録します。

```ts
"string-status": ["status: string"],
"optional-state-data": ["veterinarianId?: string"],
"plain-string-ids": ["ownerId: string", "petId: string"],
"session-00-unvalidated-exam-json": ["raw: any"],
"session-00-raw-pii-audit": ["payload: appointment"],
"session-00-message-mapped-errors": ["catch", "error.message.includes"],
"session-00-hidden-nondeterminism": ["new Date()", "randomUUID()"],
"session-00-dual-write": ["store.save", "store.appendAudit"],
```

`session-contracts.test.ts` ではSession 00本文に「SQLite」「状態保存」「監査記録」「個人情報」があり、`src/legacy` がないことを確認します。

- [ ] **Step 2: 現在のREADMEとページが新契約を満たさず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/code-explorer/code-guides/code-guides.test.ts src/session-contracts.test.ts`

Expected: guide件数、パス、fragment、本文のいずれかでFAILします。

- [ ] **Step 3: READMEとSession 00本文を更新する**

READMEへ次を記載します。

- `pnpm demo:00` と `examples/session-00/clinic.sqlite`
- 起動し直しても状態が残ること
- 明示的なresetだけが初期化すること
- 事故再現パネルとDB inspectionの読み方
- Session 00では修正せず、Session 02以降で順に改善すること

公開ページは事故報告を、状態、ID、入力、PII、失敗、非決定値、dual-write、永続JSONの8観点へ広げます。CodeGuideは実装後のファイルを `nl -ba` で確認し、各fragmentを含む最小の行範囲を設定します。

- [ ] **Step 4: ドキュメントのtest、typecheck、buildを通す**

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: source-backed guide、セッション契約、Astro buildがすべて成功します。

- [ ] **Step 5: 教材同期をコミットする**

```bash
git add examples/session-00/README.md apps/docs
git commit -m "docs(session-00): SQLite事故再現と後続学習の対応を追加"
```

### Task 9: 全体回帰と実画面を検証する

**Files:**
- Verify only: repository-wide affected files

**Interfaces:**
- Verifies: Session 00、共通UI、公開教材、全workspaceの回帰

- [ ] **Step 1: 対象packageのtest、typecheck、buildを連続実行する**

Run: `pnpm --filter @fp-with-ts/clinic-web test`

Run: `pnpm --filter @fp-with-ts/clinic-web typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-web build`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-00 build`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: すべてexit code 0です。

- [ ] **Step 2: repository-wide testとtypecheckを実行する**

Run: `pnpm test`

Run: `pnpm typecheck`

Expected: 全workspaceとworkerのテスト・型検査が成功します。

- [ ] **Step 3: 開発サーバーを0.0.0.0で起動し、ブラウザから8項目を確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 dev --host 0.0.0.0`

次を順に確認します。

- 通常フロー後に会計済みから診察中へ戻る
- 未知状態、ID取り違え、不正検査結果がDB JSONへ残る
- 予約なしが状態不正noticeになる
- 監査IDと時刻が操作ごとに変わる
- 監査失敗後に予約と最新監査の状態がずれる
- 監査JSONに氏名、メール、電話が残る
- サーバー再起動後も状態が残る
- resetで初期予約へ戻る

- [ ] **Step 4: 差分とGit管理対象を検査する**

Run: `git diff --check`

Run: `git status --short`

Run: `git ls-files examples/session-00/clinic.sqlite examples/session-00/clinic.sqlite-shm examples/session-00/clinic.sqlite-wal`

Expected: whitespace errorがなく、SQLite runtimeファイルがGit管理されていません。

- [ ] **Step 5: 残った検証修正だけを独立したコミットにする**

検証でソース修正が発生した場合だけ、変更のWhatとWhyを表すConventional Commitを作成します。検証で変更がなければコミットを追加しません。
