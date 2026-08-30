# 診察開始の識別子・SQLite・transaction統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session 03〜07とFinalのドメイン公開APIを統一し、Session 00〜07の診察開始を同じfixtureで比較できるsnapshot固有のSQLite経路へ接続します。

**Architecture:** runtimeのport、adapter、schema、migration、transactionは各snapshotに残します。`examples/start-examination-continuity`だけがsnapshot固有のcomposition rootを共通シナリオへ接続し、HTTP結果、予約状態、監査記録、保存失敗後のデータを比較します。

**Tech Stack:** TypeScript 5.9、Hono、Drizzle ORM、better-sqlite3、neverthrow、Zod、Vitest、pnpm workspace

**Spec:** `docs/superpowers/specs/2026-08-30-start-examination-sqlite-continuity-design.md`

## Global Constraints

- 対象は診察開始の1ワークフローに限定します。
- application port、DB adapter、schema、migration、transactionは各snapshotが所有します。
- snapshot間でsourceをimportしません。
- Session 02〜06で参加者が変更するファイル数と演習時間を増やしません。
- Session 02〜06のexerciseはstarterの意図した要件未達だけを残し、module resolutionやruntime配線の失敗を追加しません。
- snapshotをまたぐruntime packageは作りません。
- #110、#111、#112の順で検証可能なcommit群を作ります。
- すべてのcommitに`Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>`を付けます。
- Finalの認証、認可、他集約は途中Sessionへ移植しません。

---

### Task 1: Session 03〜07の識別子を所有概念へ移す

**Files:**
- Create: `examples/session-{03,04,05,06,07}/src/domain/appointment/{appointmentId.ts,veterinarianId.ts,index.ts}`
- Create: `examples/session-{03,04,05,06,07}/src/domain/owner/{ownerId.ts,index.ts}`
- Create: `examples/session-{03,04,05,06,07}/src/domain/pet/{petId.ts,index.ts}`
- Create: `examples/session-{03,04,05,06,07}/src/domain/examResult/{examId.ts,index.ts}`
- Delete: `examples/session-{03,04,05,06,07}/src/domain/ids/{appointmentId.ts,veterinarianId.ts,ownerId.ts,petId.ts,examId.ts}`
- Modify: `examples/session-{03,04,05,06,07}/src/{domain,boundary,useCase,adaptor,web}/**/*.ts`
- Modify: `examples/session-{03,04,05,06,07}/{exercises,test}/**/*.ts`
- Test: `packages/clinic-web/test/sessionPackages.test.ts`

**Interfaces:**
- Produces: `domain/appointment/index.js`からAppointment、遷移、AppointmentId、VeterinarianIdを公開します。
- Produces: `domain/owner/index.js`、`domain/pet/index.js`、`domain/examResult/index.js`から各概念の識別子を公開します。
- Constraint: 同じ概念内は`./appointmentId.js`のように実装ファイルを参照し、`./index.js`を参照しません。

- [ ] **Step 1: 構造契約の失敗テストを書く**

`packages/clinic-web/test/sessionPackages.test.ts`へ、Session 03〜07を走査するテストを追加します。検査対象は次の確定値です。

```typescript
const sessionsWithSemanticIds = ["03", "04", "05", "06", "07"] as const;
const ownedIdentifierPaths = [
  "domain/appointment/appointmentId.ts",
  "domain/appointment/veterinarianId.ts",
  "domain/owner/ownerId.ts",
  "domain/pet/petId.ts",
  "domain/examResult/examId.ts",
] as const;
const publicApiPaths = [
  "domain/appointment/index.ts",
  "domain/owner/index.ts",
  "domain/pet/index.ts",
  "domain/examResult/index.ts",
] as const;
```

各sessionで`src/domain/ids`が存在しないこと、上記9ファイルが存在することを`stat`で確認します。さらに`src`、`test`、`exercises`の`.ts`を読み、`/domain/ids/`を含むimportを拒否します。相対importの`.js`を`.ts`へ解決した有向graphを作り、深さ優先探索中のnodeへ戻るedgeがあれば循環経路を表示して失敗させます。

- [ ] **Step 2: テストが既存配置を理由に失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-web test -- sessionPackages.test.ts`

Expected: FAIL。最初の失敗理由は`examples/session-03/src/domain/ids`が残っていることです。

- [ ] **Step 3: 識別子ファイルを移し、concept indexを作る**

各識別子ファイルの内容は変えず、所有先だけを変えます。Session 05の公開APIは次の形にします。Session 03、04、06、07も同じ規則で、そのsnapshotに存在するファイルだけを再exportします。

```typescript
// examples/session-05/src/domain/appointment/index.ts
export * from "./appointment.js";
export * from "./appointmentId.js";
export * from "./statusLabel.js";
export * from "./transitions.js";
export * from "./veterinarianId.js";
```

```typescript
// examples/session-05/src/domain/owner/index.ts
export * from "./ownerId.js";
```

```typescript
// examples/session-05/src/domain/pet/index.ts
export * from "./petId.js";
```

```typescript
// examples/session-05/src/domain/examResult/index.ts
export * from "./examId.js";
```

Session 06と07のappointment APIには`examinationStarted.ts`も再exportします。

- [ ] **Step 4: 概念外importを公開APIへ切り替える**

次の対応をSession 03〜07のsource、test、exerciseへ適用します。

```text
domain/ids/appointmentId.js     -> domain/appointment/index.js
domain/ids/veterinarianId.js    -> domain/appointment/index.js
domain/ids/ownerId.js           -> domain/owner/index.js
domain/ids/petId.js             -> domain/pet/index.js
domain/ids/examId.js            -> domain/examResult/index.js
domain/appointment/appointment.js  -> domain/appointment/index.js ただし同じconcept内を除く
domain/appointment/transitions.js  -> domain/appointment/index.js ただし同じconcept内を除く
```

同じconcept内の`appointment.ts`、`transitions.ts`、`examinationStarted.ts`は新しい識別子の実装ファイルを直接importします。

- [ ] **Step 5: 構造契約と各snapshotの型検査を実行する**

Run: `pnpm --filter @fp-with-ts/clinic-web test -- sessionPackages.test.ts`

Run: `pnpm --filter './examples/session-{03,04,05,06,07}' typecheck`

Expected: PASS。`rg -n "domain/ids|domain/(appointment|owner|pet|examResult)/[a-zA-Z].*\.js" examples/session-{03,04,05,06,07}/src examples/session-{03,04,05,06,07}/test examples/session-{03,04,05,06,07}/exercises`は、同一concept内の直接import以外を返しません。

- [ ] **Step 6: commitする**

```bash
git add examples/session-03 examples/session-04 examples/session-05 examples/session-06 examples/session-07 packages/clinic-web/test/sessionPackages.test.ts
git commit -m "refactor(sessions): 識別子を所有概念の公開APIへ移す" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 2: Finalの公開APIと教材参照を同期し、#110を検証する

**Files:**
- Create: `examples/final/src/domain/{appointment,owner,pet,examResult}/index.ts`
- Modify: `examples/final/src/**/*.ts`
- Modify: `examples/final/test/**/*.ts`
- Modify: `apps/docs/src/pages/sessions/{03-semantic-identifiers.astro,04-boundaries-and-pii.astro,05-workflow-errors.astro,06-effects-and-consistency.astro}`
- Modify: `apps/docs/src/{session-contracts.test.ts,code-explorer/project-files.test.ts,sessions/solution-snippets.test.ts}`
- Test: `packages/clinic-web/test/sessionPackages.test.ts`

**Interfaces:**
- Consumes: Task 1の概念単位import規則。
- Produces: Finalの4概念に対する再export専用public API。

- [ ] **Step 1: Finalの公開API契約を失敗テストへ追加する**

`sessionPackages.test.ts`でFinalの4つの`index.ts`が存在することを確認します。`index.ts`の非空行が`export`で始まること、同じconcept外から対象conceptの実装ファイルを直接importしていないことも確認します。

```typescript
const finalPublicApis = ["appointment", "owner", "pet", "examResult"] as const;
```

- [ ] **Step 2: Finalにindexがないため失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-web test -- sessionPackages.test.ts`

Expected: FAIL。`examples/final/src/domain/appointment/index.ts`が存在しないと報告されます。

- [ ] **Step 3: Finalの4概念に再export専用indexを追加する**

各indexは、そのディレクトリの`.ts`から`index.ts`を除いた全ファイルを再exportします。appointmentは`appointment.ts`、`appointmentEvent.ts`、`appointmentId.ts`、`appointmentReason.ts`、`appointmentResolver.ts`、`appointmentStores.ts`、`cancellationReason.ts`、`diagnosis.ts`、`paymentAmount.ts`、`treatment.ts`、`veterinarianId.ts`を公開します。owner、pet、examResultも同じ規則で全ファイルを公開します。

- [ ] **Step 4: Finalと教材の概念外importをindexへ切り替える**

Finalのuse case、adapter、app、testは`domain/<concept>/index.js`を参照します。同じconcept内だけは実装ファイルを維持します。教材ページ、Code Explorerのproject file、solution snippet、型fixtureのパスをTask 1の新配置へ切り替えます。

- [ ] **Step 5: starterのREDがimportエラーへ変わっていないことを確認する**

Run: `pnpm exercise:02`

Expected: exit 1。5件の「要件未達」が出て、`TS2307`と`Cannot find module`は出ません。

Run: `pnpm exercise:03`

Expected: exit 1。3件の「要件未達」が出て、module resolution errorは出ません。

Run: `pnpm exercise:04`

Expected: exit 1。不正な予約IDと獣医師IDの2テストだけが失敗します。

Run: `pnpm exercise:05`

Expected: exit 1。Result課題の5テストだけが失敗します。

Run: `pnpm exercise:06`

Expected: exit 1。effect課題の4テストだけが失敗します。

- [ ] **Step 6: #110 checkpointを検証する**

Run: `pnpm --filter @fp-with-ts/clinic-web test`

Run: `pnpm --filter './examples/session-*' test`

Run: `pnpm --filter './examples/session-*' typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: すべてPASS。

- [ ] **Step 7: commitする**

```bash
git add examples/final apps/docs packages/clinic-web/test/sessionPackages.test.ts
git commit -m "refactor(domain): Finalと教材を概念単位の公開APIへ統一" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 3: Session 01をSession 00と同じSQLite事故経路へ接続する

**Files:**
- Create: `examples/session-01/drizzle/0000_initial.sql`
- Create: `examples/session-01/drizzle/meta/_journal.json`
- Create: `examples/session-01/drizzle.config.ts`
- Create: `examples/session-01/src/domain/appointment/appointment.ts`
- Create: `examples/session-01/src/useCase/startExamination.ts`
- Create: `examples/session-01/src/adaptor/secondary/sqlite/{db.ts,schema.ts,appointmentRepository.ts}`
- Create: `examples/session-01/test/integration/fileSqliteContinuity.test.ts`
- Delete: `examples/session-01/src/legacy/{appointment.ts,logger.ts}`
- Modify: `examples/session-01/src/{app.ts,server.ts,web/routes.ts}`
- Modify: `examples/session-01/test/web/clinicFlow.test.ts`
- Modify: `examples/session-01/{package.json,vite.config.ts,tsconfig.json}`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createDatabaseBackedApp({ databasePath, migrationsFolder, isProduction }): Hono`。
- Produces: `AppointmentRepository`の`find`、`save`、`appendAudit`、`listAuditLogs`、`reset`、`seedIfEmpty`。

- [ ] **Step 1: file SQLiteへ診察開始結果が残る失敗テストを書く**

一時ディレクトリのDBでappを作り、check-inとstart-examinationをPOSTします。別のbetter-sqlite3接続から次を確認します。

```typescript
expect(JSON.parse(appointment.state).status).toBe("in-examination");
expect(audit.event_name).toBe("examination.started");
expect(JSON.parse(audit.payload)).toMatchObject({
  appointmentId: clinicFixture.appointmentId,
  veterinarianId: clinicFixture.veterinarianId,
});
```

同じDBパスでappを作り直した後も状態と監査が残ること、Session 00のsourceをimportしていないことも確認します。

- [ ] **Step 2: Map実装ではSQLite結果を読めず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test -- fileSqliteContinuity.test.ts`

Expected: FAIL。`createDatabaseBackedApp`が未定義です。

- [ ] **Step 3: Session 00の現行システムをSession 01内へ複製する**

Session 01自身のdomain、use case、schema、migration、repositoryを作ります。repositoryの永続化順序は意図的に次の非原子的な2文とします。

```typescript
repository.save(updated);
repository.appendAudit({
  eventId: randomUUID(),
  eventName: "examination.started",
  occurredAt,
  appointment: updated,
});
```

`legacy`のMapとloggerを削除し、routesへrepositoryを注入します。Session 01の画面ラベルとEventStorming用の説明は維持します。

- [ ] **Step 4: packageとcomposition rootをSQLite対応にする**

`better-sqlite3`、`drizzle-orm`、`drizzle-kit`と型定義をSession 01へ追加します。`createApp`はSQLite databaseを受ける内部factoryを使い、`createDatabaseBackedApp`はfile DBを開いてmigration後にappを返します。

- [ ] **Step 5: Session 01のテスト、型検査、buildを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-01 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-01 build`

Expected: PASS。stdoutへ飼い主の連絡先を出すloggerは残りません。

- [ ] **Step 6: commitする**

```bash
git add examples/session-01 pnpm-lock.yaml
git commit -m "feat(session-01): 診察開始をSQLite事故経路へ接続" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 4: Session 02〜04へsnapshot固有SQLite adapterを配布する

**Files:**
- Create: `examples/session-{02,03,04}/drizzle/0000_initial.sql`
- Create: `examples/session-{02,03,04}/drizzle/meta/_journal.json`
- Create: `examples/session-{02,03,04}/drizzle.config.ts`
- Create: `examples/session-{02,03,04}/src/adaptor/secondary/sqlite/{db.ts,schema.ts,appointmentRepository.ts}`
- Create: `examples/session-{02,03,04}/test/integration/fileSqliteContinuity.test.ts`
- Delete: `examples/session-{02,03,04}/src/adaptor/inMemoryAppointmentStore.ts`
- Modify: `examples/session-{02,03,04}/src/{app.ts,server.ts,web/routes.ts}`
- Modify: `examples/session-{02,03,04}/test/web/clinicFlow.test.ts`
- Modify: `examples/session-{02,03,04}/{package.json,vite.config.ts,tsconfig.json}`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: 各snapshot固有の`AppointmentRepository`と`createDatabaseBackedApp`。
- Constraint: Session 02はstring ID、Session 03は状態型の解答とstringのAppointmentId、Session 04は用途別IDを保持します。

- [ ] **Step 1: 各snapshotのfile SQLite契約を失敗テストへ追加する**

各テストは共通fixtureでcheck-inと診察開始を行い、`appointments.state.kind`が`InExamination`、最新監査が`ExaminationStarted`になったことを確認します。Session 03ではPaid状態から診察開始を試し、状態と監査件数が変わらないことも確認します。

- [ ] **Step 2: in-memory adapterのため失敗することを確認する**

Run: `pnpm --filter './examples/session-{02,03,04}' test -- fileSqliteContinuity.test.ts`

Expected: FAIL。各snapshotで`createDatabaseBackedApp`が未定義です。

- [ ] **Step 3: schema、migration、repositoryをsnapshotごとに実装する**

repositoryはsnapshot固有のAppointmentをJSON stateへ保存します。監査は次の共通形を持ちますが、TypeScript型は各snapshot内で定義します。

```typescript
type AuditEvent = Readonly<{
  eventId: string;
  eventName: string;
  occurredAt: string;
  appointment: Appointment;
  payload: Readonly<Record<string, unknown>>;
}>;
```

Session 02〜04では`save`と`appendAudit`を別々に実行し、transactionへまとめません。初期行にはfixtureのowner contactも保存し、Session 04までの監査事故を再現可能にします。

- [ ] **Step 4: routesとappをrepository注入へ変える**

check-in、診察開始、診察結果、会計、キャンセルは、純粋な遷移後にrepositoryへ保存し、対応する監査eventを追記します。参加者が変更するdomainとboundaryは変更しません。

- [ ] **Step 5: Session 02〜04のテスト、型検査、buildを通す**

Run: `pnpm --filter './examples/session-{02,03,04}' test`

Run: `pnpm --filter './examples/session-{02,03,04}' typecheck`

Run: `pnpm --filter './examples/session-{02,03,04}' build`

Expected: PASS。starter exerciseの要件未達数はTask 2の期待値を維持します。

- [ ] **Step 6: commitする**

```bash
git add examples/session-02 examples/session-03 examples/session-04 pnpm-lock.yaml
git commit -m "feat(sessions): Session 02から04をSQLite永続化へ接続" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 5: Session 05へS4解答後のSQLiteとPII除外を配布する

**Files:**
- Create: `examples/session-05/drizzle/0000_initial.sql`
- Create: `examples/session-05/drizzle/meta/_journal.json`
- Create: `examples/session-05/drizzle.config.ts`
- Create: `examples/session-05/src/adaptor/secondary/sqlite/{db.ts,schema.ts,persistedAppointment.ts,appointmentPersistenceError.ts,appointmentRepository.ts}`
- Create: `examples/session-05/test/integration/fileSqliteContinuity.test.ts`
- Delete: `examples/session-05/src/adaptor/inMemoryAppointmentStore.ts`
- Modify: `examples/session-05/src/{app.ts,server.ts,web/routes.ts}`
- Modify: `examples/session-05/test/web/clinicFlow.test.ts`
- Modify: `examples/session-05/{package.json,vite.config.ts,tsconfig.json}`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `AppointmentResolver`と`InExaminationStore`。
- Produces: 同期resolverと、状態保存後に監査追記を行う非原子的なSQLite store。
- Produces: SQL失敗をPII非公開のmessageで包む`AppointmentPersistenceError`。
- Produces: 連絡先を含まない`ExaminationStartedAuditPayload`。

- [ ] **Step 1: PIIと不正入力の失敗テストを書く**

正常な診察開始後の監査payloadを文字列化し、次を確認します。

```typescript
expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerName);
expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerEmail);
expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerPhone);
```

不正なappointment IDとveterinarian IDではHTTP 500になり、予約stateと監査件数が変わらないこともfile SQLiteで確認します。

- [ ] **Step 2: in-memory storeでは永続化結果を観測できず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test -- fileSqliteContinuity.test.ts`

Expected: FAIL。SQLite composition rootが未定義です。

- [ ] **Step 3: Session 05固有のSQLite storeを実装する**

診察開始監査はaggregate全体を渡さず、次のDTOを明示的に作ります。

```typescript
type ExaminationStartedAuditPayload = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;
```

`persistedAppointment.ts`は既存の識別子schemaと`z.discriminatedUnion("kind", ...)`でDBのJSON stateを検証します。`InExaminationStore.save`のSQLite実装は予約更新後に監査INSERTを別文で実行します。`startExamination`の例外ベースstarterとexercise対象3ファイルは変更しません。SQL例外は次の型で包み、Honoの`onError`へ伝えます。

```typescript
export class AppointmentPersistenceError extends Error {
  readonly kind = "AppointmentPersistenceError";

  constructor(
    readonly operation: "resolve" | "save-state" | "append-audit",
    readonly cause: unknown,
  ) {
    super(`Appointment persistence failed: ${operation}`, { cause });
  }
}
```

- [ ] **Step 4: Session 05のテスト、型検査、buildを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-05 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-05 build`

Expected: PASS。`pnpm exercise:05`はResult課題の既存5失敗だけを返します。

- [ ] **Step 5: commitする**

```bash
git add examples/session-05 pnpm-lock.yaml
git commit -m "feat(session-05): 検証済み入力をPII非公開のSQLite監査へ接続" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 6: Session 00〜05の横断SQLite契約を追加し、#111を検証する

**Files:**
- Create: `examples/start-examination-continuity/package.json`
- Create: `examples/start-examination-continuity/tsconfig.json`
- Create: `examples/start-examination-continuity/vitest.config.ts`
- Create: `examples/start-examination-continuity/test/{snapshotScenario.ts,sqliteObservation.ts,session00To05.test.ts}`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/clinic-web/test/sessionPackages.test.ts`

**Interfaces:**
- Consumes: Session 00〜05の`createDatabaseBackedApp`。
- Produces: test専用`SnapshotScenario`。runtime sourceはこの型へ依存しません。

```typescript
type SnapshotScenario = Readonly<{
  name: "Session 00" | "Session 01" | "Session 02" | "Session 03" | "Session 04" | "Session 05";
  createApp: (databasePath: string) => Readonly<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
  }>;
  normalizeState: (state: unknown) => "Scheduled" | "CheckedIn" | "InExamination" | "AwaitingPayment" | "Paid" | "Canceled";
}>;
```

- [ ] **Step 1: 共通シナリオの失敗テストを書く**

Session 00〜05の正常系で同じfixtureを使い、check-in、診察開始、DB観測を行います。事故ごとの検査はSession 00のPaidから再開始、Session 03の状態不正拒否、Session 05の不正入力拒否とPII除外に限定します。

- [ ] **Step 2: test packageが存在しないため失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/start-examination-continuity test`

Expected: FAIL。workspace packageが見つかりません。

- [ ] **Step 3: test専用packageとSQLite観測器を実装する**

`sqliteObservation.ts`はbetter-sqlite3で`appointments.state`と`audit_logs`を読み、JSONを`unknown`として返します。`snapshotScenario.ts`だけがsnapshotごとのstatusとkindの違いを正規化します。共通テストはDB adapterの関数名やSQL呼び出し順を参照しません。

`sessionPackages.test.ts`では全Sessionの`src/**/*.ts`を走査し、`../session-`を含む相対importと`examples/session-`を含む絶対importを拒否します。横断test packageからsnapshot sourceを読むimportだけを許可します。

- [ ] **Step 4: root testとtypecheckへ横断packageを追加する**

root scriptはsession群の直後に次を実行します。

```json
{
  "test:continuity": "pnpm --filter @fp-with-ts/start-examination-continuity test",
  "typecheck:continuity": "pnpm --filter @fp-with-ts/start-examination-continuity typecheck"
}
```

既存の`test`と`typecheck`からこの2scriptを呼びます。

- [ ] **Step 5: #111 checkpointを検証する**

Run: `pnpm test:continuity`

Run: `pnpm typecheck:continuity`

Run: `pnpm --filter './examples/session-*' test`

Run: `pnpm --filter './examples/session-*' typecheck`

Run: `pnpm --filter './examples/session-*' build`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: すべてPASS。starter exerciseはTask 2の失敗内容だけを維持します。

- [ ] **Step 6: commitする**

```bash
git add examples/start-examination-continuity package.json pnpm-lock.yaml packages/clinic-web/test/sessionPackages.test.ts
git commit -m "test(continuity): Session 00から05のSQLite結果を横断比較" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 7: Session 06をResultとSQLite二重書き込みへ接続する

**Files:**
- Create: `examples/session-06/drizzle/0000_initial.sql`
- Create: `examples/session-06/drizzle/meta/_journal.json`
- Create: `examples/session-06/drizzle.config.ts`
- Create: `examples/session-06/src/adaptor/secondary/sqlite/{db.ts,schema.ts,persistedAppointment.ts,appointmentPersistenceError.ts,appointmentStore.ts}`
- Create: `examples/session-06/test/integration/fileSqliteEffects.test.ts`
- Modify: `examples/session-06/src/{app.ts,server.ts,web/routes.ts}`
- Modify: `examples/session-06/test/{web/clinicFlow.test.ts,regression/result-errors.test.ts}`
- Modify: `examples/session-06/{package.json,vite.config.ts,tsconfig.json}`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: 業務失敗を`Result`で返し、SQLite破損やSQL失敗を`AppointmentPersistenceError`のPromise rejectionで伝えるresolverとstore。
- Produces: `stateStore.save`、`eventLog.append`、`atomicStore.store`。starter use caseは前2つを使い、exercise解答は`atomicStore`を使います。

- [ ] **Step 1: 業務エラーと非原子的失敗のfile SQLiteテストを書く**

存在しない予約は`AppointmentNotFound`、Scheduledのままなら`InvalidAppointmentState`としてnoticeへ変換されることを確認します。監査INSERTを拒否するtriggerを作った後にCheckedIn予約を開始し、HTTP 500、予約stateだけ`InExamination`、監査追加なしを確認します。

```sql
CREATE TRIGGER fail_examination_audit
BEFORE INSERT ON audit_logs
WHEN NEW.event_name = 'ExaminationStarted'
BEGIN
  SELECT RAISE(FAIL, 'forced audit failure');
END;
```

- [ ] **Step 2: in-memory appではfile SQLite事故を観測できず失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-06 test -- fileSqliteEffects.test.ts`

Expected: FAIL。file database factoryが未定義です。

- [ ] **Step 3: SQLite resolverと二重書き込みstoreを実装する**

`persistedAppointment.ts`は既存の識別子schemaと`z.discriminatedUnion("kind", ...)`でDBのJSON stateを検証します。`resolveById`は業務上の未存在を`undefined`で返します。JSON破損のZod errorはそのままthrowし、SQL失敗はSession 06自身の`AppointmentPersistenceError`で包みます。どちらも`Result`の業務errorへ変換しません。

`stateStore.save`はappointmentsだけを更新し、`eventLog.append`はaudit_logsだけへINSERTします。`atomicStore.store`は同じ2操作をDrizzle transactionで実装し、S6 exercise解答が利用できる配布済みportとします。

- [ ] **Step 4: Webの業務エラーと技術的失敗を別表示へ接続する**

`AppointmentNotFound`と`InvalidAppointmentState`は既存notice redirectへ変換します。`AppointmentConflict`はconflict noticeへ変換します。SQLite例外とDB rowのZod errorはcatchせずHonoの`onError`へ渡し、500を返します。

- [ ] **Step 5: Session 06のテスト、型検査、buildを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-06 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-06 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-06 build`

Expected: PASS。`pnpm exercise:06`はeffect課題の既存4失敗だけを返します。

- [ ] **Step 6: commitする**

```bash
git add examples/session-06 pnpm-lock.yaml
git commit -m "feat(session-06): ResultをSQLite二重書き込み経路へ接続" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 8: Session 07を注入effectとDrizzle transactionへ接続する

**Files:**
- Create: `examples/session-07/drizzle/0000_initial.sql`
- Create: `examples/session-07/drizzle/meta/_journal.json`
- Create: `examples/session-07/drizzle.config.ts`
- Create: `examples/session-07/src/adaptor/secondary/sqlite/{db.ts,schema.ts,persistedAppointment.ts,appointmentPersistenceError.ts,examinationStartedStore.ts}`
- Create: `examples/session-07/test/integration/fileSqliteTransaction.test.ts`
- Modify: `examples/session-07/src/{app.ts,server.ts,web/routes.ts}`
- Modify: `examples/session-07/test/{web/clinicFlow.test.ts,in-memory-store.test.ts,regression/effects-and-events.test.ts}`
- Modify: `examples/session-07/{package.json,vite.config.ts,tsconfig.json}`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Clock`、`EventIdGenerator`、`AppointmentResolver`、`ExaminationStartedStore`。
- Produces: `store(event): ResultAsync<void, AppointmentConflict>`。SQLite例外は`AppointmentPersistenceError`のrejectionとして上位へ伝えます。

- [ ] **Step 1: rollbackと固定effectの失敗テストを書く**

固定clockとevent ID generatorで診察開始し、保存された監査の`occurredAt`と`eventId`が注入値と一致することを確認します。Session 06と同じSQLite triggerを置いた場合はHTTP 500、予約stateが`CheckedIn`、監査追加なしを確認します。

- [ ] **Step 2: appがin-memory adapterを使うためfile transactionテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-07 test -- fileSqliteTransaction.test.ts`

Expected: FAIL。file database factoryが未定義です。

- [ ] **Step 3: ExaminationStartedStoreをDrizzle transactionで実装する**

`persistedAppointment.ts`はSession 07自身の識別子schemaとdiscriminated unionでDBのJSON stateを検証します。SQL失敗はSession 07自身の`AppointmentPersistenceError`で包み、破損JSONのZod errorはそのままrejectionへ渡します。

transaction内で現在行を再読込し、存在しないかCheckedInでなければ次を返します。書き込み前なので、このResultで終了しても不整合は生じません。

```typescript
err({
  kind: "AppointmentConflict",
  appointmentId: event.appointmentId,
} as const)
```

CheckedInならappointments更新とaudit_logs INSERTを同じtransaction callback内で実行します。SQL例外はtransactionからthrowされ、better-sqlite3がrollbackします。`ResultAsync.fromSafePromise`を使い、インフラ例外を業務Resultへ変換しません。

- [ ] **Step 4: composition rootをSQLite adapterへ切り替える**

default appは`:memory:`へmigrationして起動します。`createDatabaseBackedApp`は指定fileを使います。in-memory adapterはuse case単体テスト用に残しますが、runtime appからは参照しません。

- [ ] **Step 5: Session 07のテスト、型検査、buildを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-07 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-07 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-07 build`

Expected: PASS。固定effect、conflict Result、store failure rejection、rollbackを別々に確認できます。

- [ ] **Step 6: commitする**

```bash
git add examples/session-07 pnpm-lock.yaml
git commit -m "feat(session-07): 診察開始の状態と監査をtransaction保存" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 9: 横断契約をSession 06〜07へ拡張し、#112を検証する

**Files:**
- Modify: `examples/start-examination-continuity/test/{snapshotScenario.ts,session00To05.test.ts}`
- Create: `examples/start-examination-continuity/test/session06To07.test.ts`
- Modify: `examples/start-examination-continuity/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Extends: `SnapshotScenario.name`へ`Session 06`と`Session 07`を追加します。
- Produces: 業務エラー、技術的失敗、effect注入、rollbackの横断契約。

- [ ] **Step 1: Session 06〜07の横断失敗テストを書く**

同じfixtureとHTTP操作で次を比較します。

```typescript
expect(session06.auditFailure).toEqual({
  httpStatus: 500,
  appointmentKind: "InExamination",
  appendedEvents: 0,
});
expect(session07.auditFailure).toEqual({
  httpStatus: 500,
  appointmentKind: "CheckedIn",
  appendedEvents: 0,
});
```

Session 07の正常系では固定event IDと時刻を監査行から確認します。予約なし、状態不正、監査失敗が異なるHTTP観測結果になることも確認します。

- [ ] **Step 2: scenario未登録で失敗することを確認する**

Run: `pnpm test:continuity`

Expected: FAIL。Session 06またはSession 07のscenarioが未定義です。

- [ ] **Step 3: 2つのsnapshot adapterを追加する**

各adapterはsnapshot固有の`createDatabaseBackedApp`を呼び、共通fixtureで初期化します。SQLite triggerの作成とDB観測はtest package内に置き、runtimeへ失敗flagやcallbackを追加しません。

- [ ] **Step 4: #112 checkpointを検証する**

Run: `pnpm test:continuity`

Run: `pnpm typecheck:continuity`

Run: `pnpm --filter './examples/session-*' test`

Run: `pnpm --filter './examples/session-*' typecheck`

Run: `pnpm --filter './examples/session-*' build`

Run: `pnpm --filter @fp-with-ts/docs test`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: すべてPASS。starter exerciseの失敗内容はTask 2の期待値を維持します。

- [ ] **Step 5: commitする**

```bash
git add examples/start-examination-continuity pnpm-lock.yaml
git commit -m "test(continuity): ResultとtransactionのSQLite契約を横断比較" -m "Co-Authored-By: Codex Opus 4.5 <noreply@anthropic.com>"
```

### Task 10: 全体検証、レビュー、Draft PR

**Files:**
- Inspect: `git diff --name-only main...HEAD`でTask 1〜9の全変更ファイルを対象にします。
- Create outside repository: `/tmp/fp-start-examination-pr.md`

**Interfaces:**
- Consumes: Task 1〜9の全checkpoint。
- Produces: #110、#111、#112を順にレビューできるDraft PR。

- [ ] **Step 1: worktreeが意図した差分だけを持つことを確認する**

Run: `git status --short`

Run: `git diff --check main...HEAD`

Run: `git log --oneline main..HEAD`

Expected: 未commitファイルなし、whitespace errorなし、設計、#110、#111、#112の順でcommitが並びます。

- [ ] **Step 2: 全体testをfreshに実行する**

Run: `pnpm test`

Expected: PASS。

- [ ] **Step 3: 全体typecheckをfreshに実行する**

Run: `pnpm typecheck`

Expected: PASS。

- [ ] **Step 4: 全体buildをfreshに実行する**

Run: `pnpm build`

Expected: PASS。

- [ ] **Step 5: starter exerciseの診断を再確認する**

Task 2の5コマンドを再実行し、意図した要件未達だけで終了することを確認します。solution snippetとdocs testは`pnpm --filter @fp-with-ts/docs test`でPASSすることを確認します。

- [ ] **Step 6: 受け入れ条件を自己レビューする**

`rg -n "domain/ids" examples/session-{03,04,05,06,07} apps/docs`の結果を確認し、教材内の過去説明以外が空になることを確認します。Session 00〜07のappがすべてfile SQLite factoryを公開し、Session 06だけが二重書き込み事故を残し、Session 07だけがtransaction完了形になったことをdiffから確認します。

- [ ] **Step 7: reviewで見つかったCriticalとImportantを修正する**

修正が必要な場合は、失敗テストを追加し、最小修正、対象test、全体testの順で確認して独立commitにします。指摘のきっかけではなく、修正した不変条件をcommit messageに書きます。

- [ ] **Step 8: branchをpushしてDraft PRを作る**

`/tmp/fp-start-examination-pr.md`を次の内容で作ります。

```markdown
## 背景

Sessionごとの診察開始が異なるin-memory実装へ分断され、識別子、状態制約、境界検証、Result、effect、transactionを同じ永続化結果で比較できませんでした。

## 内容

各snapshotがruntime実装を所有する方針を維持し、同じfixtureと利用者操作をsnapshot固有のSQLite経路へ接続しました。ドメイン公開API、業務エラーと技術的失敗の境界、状態と監査のtransaction保存を段階ごとに確認できる横断契約を追加しています。

## 論点

runtimeの重複は教材上の境界を見せるため残し、共通化をfixtureと横断テストに限定しています。

## Test Plan

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`

Closes #110
Closes #111
Closes #112
```

```bash
git push -u origin codex/fix-visit-start-transactions
gh pr create --draft --title "feat(sessions): 診察開始をSQLite transactionへ段階接続" --body-file /tmp/fp-start-examination-pr.md
```

Ready化、merge、force-pushは行いません。
