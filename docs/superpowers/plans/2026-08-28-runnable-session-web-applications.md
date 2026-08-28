# Runnable Session Web Applications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `examples/session-00` から `examples/session-07` を、共通のReact/Inertia画面とセッション固有のHono routesで操作できるWebアプリケーションにします。

**Architecture:** `packages/clinic-web` は表示部品、画面向け契約、Inertia client、root view、Vite設定だけを共有します。各 `examples/session-NN` はHono app、routes、in-memory storeを所有し、そのスナップショットのlegacy、遷移関数、境界、use caseを直接呼びます。

**Tech Stack:** TypeScript 5.9、Hono 4、`@hono/inertia` 0.7、Inertia React 3、React 19、Vite 6、Vitest 2、neverthrow 8、Zod 3

**Spec:** `docs/superpowers/specs/2026-08-28-runnable-session-web-applications-design.md`

## Global Constraints

- Hono routesを共通パッケージへ移しません。
- Session 00からSession 07まで同じURL、port 3000、`examples/fixtures/clinic.ts` の値を使います。
- 各演習の対象ディレクトリ、最大4ステップ、最大3件の設計判断、最大5ファイル・実効80行を増やしません。
- `examples/session-02` はstarter、次のsnapshotは前セッションの解答という契約を維持します。
- `exercise:02` から `exercise:06` は開始時の業務名付きREDと次snapshotのGREENを維持します。
- 未実装操作は500や404ではなく、303で `/?notice=not-implemented` へ戻します。
- 未知の障害だけを詳細のない500へ変換します。
- TypeScriptの相対importには `.js` suffixを付けます。

---

### Task 1: 共通Webパッケージ

**Files:**
- Create: `packages/clinic-web/package.json`
- Create: `packages/clinic-web/tsconfig.json`
- Create: `packages/clinic-web/vitest.config.ts`
- Create: `packages/clinic-web/src/contracts.ts`
- Create: `packages/clinic-web/src/notice.ts`
- Create: `packages/clinic-web/src/ClinicDashboard.tsx`
- Create: `packages/clinic-web/src/client.tsx`
- Create: `packages/clinic-web/src/rootView.tsx`
- Create: `packages/clinic-web/src/viteConfig.ts`
- Create: `packages/clinic-web/src/index.ts`
- Move: `examples/final/src/adaptor/primary/web/components/AppShell.tsx` and generic components to `packages/clinic-web/src/components/`
- Move: `examples/final/src/adaptor/primary/web/styles.css` to `packages/clinic-web/src/styles.css`
- Modify: Final component imports and `examples/final/src/adaptor/primary/web/client.tsx`
- Test: `packages/clinic-web/test/contracts.test.ts`
- Test: `packages/clinic-web/test/ClinicDashboard.test.tsx`

**Interfaces:**
- Produces: `ActionAvailability`, `AppointmentActions`, `ClinicAppointmentView`, `ClinicPageProps`, `Notice`
- Produces: `noticeFromCode(raw: string | undefined): Notice`
- Produces: `notImplemented(context: Context): Response`
- Produces: `createClinicRootView(isProduction: boolean, developmentClientSource: string): RootView`
- Produces: `createClinicViteConfig()` and `startClinicClient()`

- [ ] **Step 1: Write the contract and UI tests**

```ts
it("rejects arbitrary notice text", () => {
  expect(noticeFromCode("<script>alert(1)</script>")).toBeNull();
});

it("renders unimplemented separately and omits hidden actions", () => {
  const html = renderToStaticMarkup(<ClinicDashboard {...props} />);
  expect(html).toContain("未実装");
  expect(html).not.toContain("キャンセルする");
});

it("shows only the fixed not-implemented message", () => {
  const html = renderToStaticMarkup(
    <ClinicDashboard {...props} notice={{ kind: "FeatureNotImplemented" }} />,
  );
  expect(html).toContain("この機能は未実装です");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-web test`

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Implement the minimal contracts and page**

```ts
export type ActionAvailability =
  | Readonly<{ kind: "Available"; href: string; method: "get" | "post"; data?: Readonly<Record<string, string>> }>
  | Readonly<{ kind: "NotImplemented"; href: string; method: "get" | "post"; data?: Readonly<Record<string, string>> }>
  | Readonly<{ kind: "Hidden" }>;

export type Notice =
  | Readonly<{ kind: "FeatureNotImplemented" }>
  | Readonly<{ kind: "InvalidAppointmentState" }>
  | Readonly<{ kind: "AppointmentNotFound" }>
  | Readonly<{ kind: "AppointmentConflict" }>
  | null;
```

`ClinicDashboard` は `router.visit` で `Available` と `NotImplemented` を送信し、`Hidden` は描画しません。notice本文は `kind` の網羅分岐から固定文言を選びます。

- [ ] **Step 4: Extract Final's generic presentation components**

`AppShell` のuser型を共通の `ClinicUserView` へ置き換えます。Final固有の `appointmentPresentation.ts` と各pageはFinalへ残し、共通componentだけをpackage exportからimportします。

- [ ] **Step 5: Run package and Final tests**

Run: `pnpm --filter @fp-with-ts/clinic-web test && pnpm --filter @fp-with-ts/clinic-web typecheck && pnpm --filter @fp-with-ts/clinic-final test && pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/clinic-web examples/final
git commit -m "feat(web): セッションとFinalの表示基盤を共有"
```

### Task 2: Session 00のlegacy Webアプリ

**Files:**
- Modify: `examples/session-00/package.json`
- Modify: `examples/session-00/tsconfig.json`
- Modify: `examples/session-00/src/legacy/appointment.ts`
- Create: `examples/session-00/vite.config.ts`
- Create: `examples/session-00/src/server.ts`
- Create: `examples/session-00/src/app.ts`
- Create: `examples/session-00/src/web/client.tsx`
- Create: `examples/session-00/src/web/routes.ts`
- Create: `examples/session-00/test/web/clinicFlow.test.ts`

**Interfaces:**
- Consumes: `ClinicPageProps`, `noticeFromCode`, `notImplemented`, `createClinicRootView`, `createClinicViteConfig`
- Produces: `createApp(): Hono`
- Produces: `findAppointment(id: string): LegacyAppointment | undefined`

- [ ] **Step 1: Write the failing route flow test**

```ts
it("reproduces the paid-to-in-examination incident through Hono", async () => {
  const app = createApp();
  await post(app, "/appointments/11111111-1111-4111-8111-111111111111/check-in");
  await post(app, "/appointments/11111111-1111-4111-8111-111111111111/start-examination");
  await post(app, "/appointments/11111111-1111-4111-8111-111111111111/exam-results");
  await post(app, "/appointments/11111111-1111-4111-8111-111111111111/payment");
  await post(app, "/appointments/11111111-1111-4111-8111-111111111111/start-examination");
  expect(await page(app)).toMatchObject({ appointment: { kind: "InExamination" } });
});

it("redirects a follow-up request to the fixed notice", async () => {
  const response = await post(app, "/follow-ups/request");
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/?notice=not-implemented");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test`

Expected: FAIL because `createApp` and the routes do not exist.

- [ ] **Step 3: Add the session-owned Hono app and routes**

Register all URLs from the spec in `src/web/routes.ts`. Seed one `Scheduled` appointment from `clinicFixture`. S0 returns every legacy transition as `Available`, including starting an examination after payment, so the incident remains clickable. `/follow-ups/request` calls `notImplemented`.

- [ ] **Step 4: Add dev/build scripts and verify GREEN**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test && pnpm --filter @fp-with-ts/clinic-session-00 typecheck && pnpm --filter @fp-with-ts/clinic-session-00 build`

Expected: PASS and `dist/index.js` plus client assets exist.

- [ ] **Step 5: Commit**

```bash
git add examples/session-00
git commit -m "feat(session-00): legacy業務をHono画面から再現可能にする"
```

### Task 3: Session 01の独立Webアプリ

**Files:**
- Modify: `examples/session-01/package.json`
- Create: `examples/session-01/tsconfig.json`
- Create: `examples/session-01/vitest.config.ts`
- Create: `examples/session-01/vite.config.ts`
- Create: `examples/session-01/src/legacy/appointment.ts`
- Create: `examples/session-01/src/legacy/logger.ts`
- Create: `examples/session-01/src/server.ts`
- Create: `examples/session-01/src/app.ts`
- Create: `examples/session-01/src/web/client.tsx`
- Create: `examples/session-01/src/web/routes.ts`
- Create: `examples/session-01/test/web/clinicFlow.test.ts`

**Interfaces:**
- Consumes: Task 1's common Web contracts
- Produces: a standalone `@fp-with-ts/clinic-session-01` package and `createApp()`

- [ ] **Step 1: Write a failing independence test**

```ts
it("runs the legacy workflow without importing session-00", async () => {
  const app = createApp();
  const response = await app.request("/", { headers: { Accept: "application/json" } });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ appointment: { kind: "Scheduled" } });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test`

Expected: FAIL because Session 01 is not a package.

- [ ] **Step 3: Implement the standalone S1 package**

Copy the legacy behavior into S1-owned modules and register S1-owned routes. Do not import `examples/session-00/src`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/clinic-session-01 test && pnpm --filter @fp-with-ts/clinic-session-01 typecheck && pnpm --filter @fp-with-ts/clinic-session-01 build`

```bash
git add examples/session-01
git commit -m "feat(session-01): 業務イベント分析用の独立アプリを追加"
```

### Task 4: AwaitingPaymentをS2から全snapshotへ伝播

**Files:**
- Modify: `examples/session-02/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: `examples/session-03/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: `examples/session-04/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: `examples/session-05/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: `examples/session-06/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: `examples/session-07/src/domain/appointment/{appointment.ts,transitions.ts,statusLabel.ts}`
- Modify: S2 transition tests, type fixtures, compile fixture, S3-S7 regression copies
- Modify: `apps/docs/src/pages/sessions/02-state-transitions.astro`
- Modify: `apps/docs/src/sessions/catalog.ts`
- Modify: Session README files that describe the state count

**Interfaces:**
- Produces: `AwaitingPayment`, `CompleteExaminationInput`
- Produces: `completeExamination(InExamination, CompleteExaminationInput, string): AwaitingPayment`
- Changes: `recordPayment` consumes `AwaitingPayment`

- [ ] **Step 1: Add failing runtime and compile fixtures**

```ts
it("診察結果の記録後だけ会計できる", () => {
  const awaiting = completeExamination(
    examining,
    { examId: clinicFixture.examId },
    completedAt,
  );
  expect(awaiting.kind).toBe("AwaitingPayment");
  expect(recordPayment(awaiting, payment, paidAt).kind).toBe("Paid");
});

// @ts-expect-error InExamination から直接会計できません。
recordPayment(examining, payment, paidAt);
```

- [ ] **Step 2: Run S2 exercise and S3 regression to verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-session-02 test && pnpm --filter @fp-with-ts/clinic-session-03 test`

Expected: FAIL because `AwaitingPayment` and `completeExamination` do not exist.

- [ ] **Step 3: Implement the six-state model in every snapshot**

S2 keeps broad `Appointment -> Appointment` signatures and runtime `requireKind`. S3-S7 use `InExamination -> AwaitingPayment` and `AwaitingPayment -> Paid`. S4-S7 use branded `ExamId`; S2-S3 use `string`.

- [ ] **Step 4: Update exhaustiveness instrumentation and docs**

Rename `printWithSixthAppointmentState` to `printWithSeventhAppointmentState`, preserve injection of `Deferred`, and change assertions from「6つ目」to「7つ目」. Add `AwaitingPayment` to every status label and S2 teaching snippet.

- [ ] **Step 5: Verify exercises, regression, docs, and commit**

Run: `pnpm exercise:02` and confirm the intended assertion failure.

Run: `pnpm --filter @fp-with-ts/clinic-session-03 test && pnpm --filter @fp-with-ts/clinic-session-04 test && pnpm --filter @fp-with-ts/clinic-session-05 test && pnpm --filter @fp-with-ts/clinic-session-06 test && pnpm --filter @fp-with-ts/clinic-session-07 test && pnpm --filter @fp-with-ts/docs test`

Expected: all regression and docs tests PASS.

```bash
git add examples/session-02 examples/session-03 examples/session-04 examples/session-05 examples/session-06 examples/session-07 apps/docs
git commit -m "feat(session-02): 診察完了と会計を別の予約状態にする"
```

### Task 5: Session 02からSession 04のWeb接続

**Files:**
- Modify: `examples/session-{02,03,04}/package.json`
- Modify: `examples/session-{02,03,04}/tsconfig.json`
- Create: `examples/session-{02,03,04}/vite.config.ts`
- Create: `examples/session-{02,03,04}/src/{app.ts,server.ts}`
- Create: `examples/session-{02,03,04}/src/web/{client.tsx,routes.ts,appointmentView.ts}`
- Create: `examples/session-{02,03,04}/src/adaptor/inMemoryAppointmentStore.ts`
- Create: `examples/session-{02,03,04}/test/web/clinicFlow.test.ts`

**Interfaces:**
- Each package produces `createApp()` and session-owned routes
- Session 02 route consumes unsafe transition functions
- Session 03 route consumes typed transitions and raw IDs
- Session 04 route consumes branded IDs and `ExamResult.parse`

- [ ] **Step 1: Write failing flow tests for each snapshot**

For each package, assert `GET /` returns `Scheduled`, the five-step flow reaches `Paid`, payment before exam result is rejected, follow-up returns the fixed 303, and reset restores the same fixture. S4 additionally posts malformed exam JSON and asserts it demonstrates the starter boundary behavior without the common package repairing it.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-session-02 test && pnpm --filter @fp-with-ts/clinic-session-03 test && pnpm --filter @fp-with-ts/clinic-session-04 test`

Expected: FAIL because the Web apps do not exist.

- [ ] **Step 3: Implement S2 routes and store**

Narrow `appointment.kind` in the local route before invoking transitions so the same route compiles before and after the exercise. The S2 domain functions remain unsafe; only the HTTP input boundary performs the state branch needed to select an action.

- [ ] **Step 4: Implement S3 routes and store**

Parse fixture values with distributed ID helpers before passing them to transitions. Branded values remain assignable to the S3 starter's raw string parameters and keep the route compilable after the participant applies the S3 solution.

- [ ] **Step 5: Implement S4 routes and store**

Pass the posted lab payload to `ExamResult.parse`, branch on its `Result`, and call `completeExamination` with the parsed `examId`. Do not add validation outside `src/boundary`, because the starter must demonstrate why that boundary is unsafe.

- [ ] **Step 6: Verify and commit each package**

Run: `pnpm --filter @fp-with-ts/clinic-session-02 test && pnpm --filter @fp-with-ts/clinic-session-02 typecheck && pnpm --filter @fp-with-ts/clinic-session-02 build`

Run: `pnpm --filter @fp-with-ts/clinic-session-03 test && pnpm --filter @fp-with-ts/clinic-session-03 typecheck && pnpm --filter @fp-with-ts/clinic-session-03 build`

Run: `pnpm --filter @fp-with-ts/clinic-session-04 test && pnpm --filter @fp-with-ts/clinic-session-04 typecheck && pnpm --filter @fp-with-ts/clinic-session-04 build`

Expected: PASS.

```bash
git add examples/session-02 examples/session-03 examples/session-04
git commit -m "feat(sessions): 状態と入力境界をHono routesへ接続"
```

### Task 6: Session 05からSession 07のWeb接続

**Files:**
- Modify: `examples/session-{05,06,07}/package.json`
- Modify: `examples/session-{05,06,07}/tsconfig.json`
- Create: `examples/session-{05,06,07}/vite.config.ts`
- Create: `examples/session-{05,06,07}/src/{app.ts,server.ts}`
- Create: `examples/session-{05,06,07}/src/web/{client.tsx,routes.ts,appointmentView.ts}`
- Create or modify: in-memory adaptors for each package
- Create: `examples/session-{05,06,07}/test/web/clinicFlow.test.ts`

**Interfaces:**
- Session 05 route consumes the starter `Result`
- Session 06 route consumes `startExaminationWithEffects` and separate state/event writers
- Session 07 route consumes the existing atomic `ExaminationStartedStore`

- [ ] **Step 1: Write failing Result and effect route tests**

```ts
it("maps a typed invalid state to an allowlisted notice", async () => {
  const response = await post(app, `${appointmentUrl}/start-examination`);
  expect(response.headers.get("location")).toBe("/?notice=invalid-state");
});

it("returns an opaque 500 for an unexpected store rejection", async () => {
  const app = createApp({ failStore: true });
  const response = await post(app, `${appointmentUrl}/start-examination`);
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Internal Server Error");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test && pnpm --filter @fp-with-ts/clinic-session-06 test && pnpm --filter @fp-with-ts/clinic-session-07 test`

Expected: FAIL because the Web apps do not exist.

- [ ] **Step 3: Implement Session 05 Result mapping**

Map `AppointmentNotFound` to `/?notice=not-found` and `InvalidAppointmentState` to `/?notice=invalid-state`. Preserve the starter's coarse catch behavior; the route only branches on returned `kind`.

- [ ] **Step 4: Implement Session 06 effect wiring**

Provide the route with one in-memory resolver, one state writer, and one event writer. Call `startExaminationWithEffects` so the S6 starter's direct `Date`/`randomUUID` and two writes remain on the browser path.

- [ ] **Step 5: Implement Session 07 atomic wiring**

Use `createInMemoryExaminationStartedStore` for diagnosis start. Extend the adapter with production methods needed by the remaining appointment routes, and write its failing tests before adding those methods. Let rejected storage promises reach `app.onError`, while `AppointmentConflict` maps to the allowlisted notice.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test && pnpm --filter @fp-with-ts/clinic-session-05 typecheck && pnpm --filter @fp-with-ts/clinic-session-05 build`

Run: `pnpm --filter @fp-with-ts/clinic-session-06 test && pnpm --filter @fp-with-ts/clinic-session-06 typecheck && pnpm --filter @fp-with-ts/clinic-session-06 build`

Run: `pnpm --filter @fp-with-ts/clinic-session-07 test && pnpm --filter @fp-with-ts/clinic-session-07 typecheck && pnpm --filter @fp-with-ts/clinic-session-07 build`

Expected: PASS.

```bash
git add examples/session-05 examples/session-06 examples/session-07
git commit -m "feat(sessions): Resultと副作用をWeb操作へ接続"
```

### Task 7: 実行案内とCI契約

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/*.yml`
- Modify: `README.md`
- Modify: `docs/event/participant-setup.md`
- Modify: `docs/event/facilitator-guide.md`
- Modify: each session README
- Test: existing workspace and docs tests

**Interfaces:**
- Produces: `pnpm demo:00` through `pnpm demo:07`
- Changes: root `build`, `typecheck`, `test` include every session and the common Web package

- [ ] **Step 1: Add a failing root contract check**

Extend the existing workspace test or package script test so it fails when a `session-*` package lacks `dev`, `build`, `typecheck`, or `test`. Derive package names from the workspace instead of listing only selected sessions in CI.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test`

Expected: FAIL until all root scripts and Session 01 discovery are connected.

- [ ] **Step 3: Add demo and verification scripts**

Add `demo:00` through `demo:07`. Update root `build`, `typecheck`, and `test` filters to include `@fp-with-ts/clinic-web` and all `examples/session-*` packages.

- [ ] **Step 4: Synchronize participant and facilitator docs**

Document port 3000, one server at a time, `/demo/reset`, the fixed unimplemented dialog, and the command for each session. Keep exercise commands unchanged.

- [ ] **Step 5: Verify CI-equivalent commands**

Run: `pnpm typecheck`

Run: `pnpm test`

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json .github README.md docs examples/*/README.md
git commit -m "ci(sessions): 全Webスナップショットのデモ可能性を検査"
```

### Task 8: 全体検証とDraft PR更新

**Files:**
- Modify only when verification reveals a defect
- Update: Draft PR #86 title and body

**Interfaces:**
- Consumes: all prior tasks
- Produces: a clean branch with CI-equivalent verification evidence

- [ ] **Step 1: Verify the public exercise contract**

Run `pnpm exercise:02` through `pnpm exercise:06` and confirm each starter fails only with the documented business assertions. Run each next snapshot's regression tests and confirm they pass.

- [ ] **Step 2: Verify every demo package**

Run package test, typecheck, and build for `session-00` through `session-07`. Confirm each generated server can answer `GET /` through its Hono test without binding a port.

- [ ] **Step 3: Run full repository verification**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 4: Inspect the final diff**

Run: `git status --short`, `git diff --check`, `git diff origin/main...HEAD --stat`, and inspect changes for unrelated redesign, secrets, generated databases, and copied route infrastructure.

- [ ] **Step 5: Push and update Draft PR #86**

Push `codex/design-runnable-session-apps`. Rewrite the PR body with the final background, architectural approach, review points, and verification results. Keep the PR draft.
