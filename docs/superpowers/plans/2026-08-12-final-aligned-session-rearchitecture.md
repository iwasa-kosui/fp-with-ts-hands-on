# Final-Aligned Session Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `examples/final` の状態、境界、失敗、成功 event、原子的保存、認可・安全な出力を、事故ごとに学べる `00`〜`13`＋Finalへ再構成する。

**Architecture:** `examples/session-NN` は Session NN の開始状態を持つ自己完結 pnpm package とする。exercise は一つの未実装契約だけを失敗として示し、次の snapshot が解答状態になる。参加者ページ、Code Explorer、root command、PRD、イベント資料は同じ番号・名称・検証コマンドを参照する。Final は参照実装であり、演習対象にしない。

**Tech Stack:** TypeScript 5、Vitest、Zod、neverthrow、Astro、Hono、Inertia、React、Drizzle ORM、SQLite

## Global Constraints

- 各回は「事故 → 不変条件 → 最小の手段 → 限界 → 検証 → 振り返り」の順にする。編集は最大2関数。
- `Readonly` な `type`、`kind` 判別子、純粋遷移、Zod boundary、branded value、`Sensitive`、判別可能な `Result` error を維持する。外部値を `as` で偽装しない。
- 成功 event は event sourcing・非同期配信の同義語ではない。失敗経路では event を生成しない。
- Final は projection と監査 event を同一 transaction で保存し、競合を typed error として返す。PII は `Sensitive`、監査 payload の allowlist、認可済み page DTO で重ねて守る。
- 通常の `test` は成功を期待する。意図した失敗は対応する `exercise:NN` のみに置く。
- `examples/final/test/web/clinicFlow.test.ts` の既存 302/303 不一致は、教材変更と別コミットで直し、期待値を302へ弱めない。

## Snapshot sequence

| 開始 | 演習の一つの判断 | 次の解答 |
| --- | --- | --- |
| 00 | legacy の事故を読む | 01 |
| 01 | 事故を不変条件のテストへ翻訳する | 02 |
| 02 | `Scheduled` と `CheckedIn` の状態語彙 | 03 |
| 03 | `CheckedIn` からだけ診察開始する | 04 |
| 04 | `AwaitingPayment` で診察と会計を分ける | 05 |
| 05 | `Canceled` だけが取消理由を持つ | 06 |
| 06 | `unknown` を Zod で検証する | 07 |
| 07 | ID・金額・時刻を brand で区別する | 08 |
| 08 | PII を JSON・String・inspect から守る | 09 |
| 09 | 未発見・状態不正を `Result` error にする | 10 |
| 10 | 成功遷移だけを typed event にする | 11 |
| 11 | resolver/store を `ResultAsync` use case で合成する | 12 |
| 12 | state と event を原子的に保存し競合を拒否する | 13 |
| 13 | follow-up の認可、重複 claim、安全な出力を分ける | Final |

All new manifests are named `@fp-with-ts/clinic-session-NN` and expose `build`, `typecheck`, `test`, `exercise` just as `examples/session-05/package.json` does. Each README has `開始状態`、`この回で変える関数`、`検証`、`次の snapshot` headings in order.

---

### Task 1: Build the incident and state snapshots (00–06)

**Files:**
- Modify: `examples/session-00/**` through `examples/session-05/**`
- Create: `examples/session-06/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,README.md,src/**,test/**,exercises/**}`
- Create: `examples/session-02/exercises/state-vocabulary.test.ts`, `examples/session-03/exercises/state-transitions.test.ts`, `examples/session-04/exercises/awaiting-payment.test.ts`, `examples/session-05/exercises/cancellation.test.ts`

**Interfaces:** Produces `Scheduled | CheckedIn | InExamination | AwaitingPayment | Paid | Canceled`. `recordPayment` accepts only `AwaitingPayment`; `cancel` accepts `Scheduled | CheckedIn`; `isTerminal` returns `Paid | Canceled`.

- [ ] **Step 1: Write the focused RED exercises**

```typescript
const completed = Appointment.completeExamination(examining, { examId, now });
expect(completed.kind).toBe("AwaitingPayment");
const paid = Appointment.recordPayment(completed, { amount: 4_800 }, now);
expect(paid.kind).toBe("Paid");

// @ts-expect-error 会計待ち前に会計できない。
Appointment.recordPayment(examining, { amount: 4_800 }, now);
```

Session 00 retains its legacy incident. Session 01’s exercise is a characterization test and introduces no production edit. Sessions 02–05 each have one failing exercise and one ordinary regression test naming the same invariant.

- [ ] **Step 2: Confirm the RED conditions**

Run: `pnpm exercise:00; pnpm exercise:01; pnpm exercise:02; pnpm exercise:03; pnpm exercise:04; pnpm exercise:05`

Expected: each command fails only because the current state contract is absent; ordinary tests pass.

- [ ] **Step 3: Implement each next-state solution**

```typescript
export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: string;
  petId: string;
  ownerId: string;
  checkedInAt: string;
  veterinarianId: string;
  examinationStartedAt: string;
  examId: string;
  examinationCompletedAt: string;
}>;

export const recordPayment = (
  appointment: AwaitingPayment,
  input: Readonly<{ amount: number }>,
  paidAt: string,
): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt });
```

`session-03` solves state vocabulary; `session-04` adds narrowed `startExamination` and `assertNever` display coverage; `session-05` adds `AwaitingPayment`; `session-06` adds state-specific cancellation and terminal detection. Do not introduce Zod, brands, `Result`, events, or persistence here.

- [ ] **Step 4: Verify all state snapshots**

Run: `pnpm --filter @fp-with-ts/clinic-session-00 test && pnpm --filter @fp-with-ts/clinic-session-01 test && pnpm --filter @fp-with-ts/clinic-session-02 test && pnpm --filter @fp-with-ts/clinic-session-03 test && pnpm --filter @fp-with-ts/clinic-session-04 test && pnpm --filter @fp-with-ts/clinic-session-05 test && pnpm --filter @fp-with-ts/clinic-session-06 test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/session-00 examples/session-01 examples/session-02 examples/session-03 examples/session-04 examples/session-05 examples/session-06
git commit -m "feat(examples): split appointment state progression"
```

### Task 2: Build boundary, value, and PII snapshots (06–09)

**Files:**
- Modify: `examples/session-06/**`
- Create: `examples/session-07/**`, `examples/session-08/**`, `examples/session-09/**`
- Modify: `pnpm-lock.yaml` only if package dependencies require it

**Interfaces:** `session-07` adds `schemaResult` and `StartExaminationInput.parse(raw: unknown)`; `session-08` adds branded IDs, `Timestamp`, `PaymentAmount`; `session-09` adds redacting `Sensitive` and `OwnerContact.parse`.

- [ ] **Step 1: Write independent RED exercises**

```typescript
expect(StartExaminationInput.parse({ appointmentId: "not-a-uuid" }).isErr()).toBe(true);

// @ts-expect-error PetId cannot satisfy ownerId.
OwnerContact.parse({ ownerId: petId, ownerPhone: "090-0000-0000" });

const contact = OwnerContact.parse(validRaw)._unsafeUnwrap();
expect(JSON.stringify(contact)).not.toContain("090-0000-0000");
expect(String(contact.ownerPhone)).toBe("[REDACTED]");
```

- [ ] **Step 2: Confirm each defense fails separately**

Run: `pnpm exercise:06; pnpm exercise:07; pnpm exercise:08`

Expected: schema validation, value confusion, and redaction each fail in their own exercise.

- [ ] **Step 3: Implement one-way boundary conversion**

```typescript
export const schemaResult = <TSchema extends z.ZodType>(schema: TSchema) =>
  (raw: unknown): Result<z.output<TSchema>, SchemaValidationError> => {
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "SchemaValidationError", issues: parsed.error.issues });
  };
```

Define IDs with `z.string().uuid().brand<"AppointmentId">()`-style schemas. `Sensitive.of` supplies `toJSON`, `toString`, and Node inspect redaction; it does not validate input or replace a brand.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/clinic-session-07 test && pnpm --filter @fp-with-ts/clinic-session-08 test && pnpm --filter @fp-with-ts/clinic-session-09 test`

Expected: PASS.

```bash
git add examples/session-06 examples/session-07 examples/session-08 examples/session-09 pnpm-lock.yaml
git commit -m "feat(examples): separate boundary value and pii defenses"
```

### Task 3: Build typed-failure and successful-event snapshots (09–11)

**Files:**
- Modify: `examples/session-09/**`
- Create: `examples/session-10/**`, `examples/session-11/**`
- Create: `examples/session-09/exercises/typed-failures.test.ts`, `examples/session-10/exercises/success-events.test.ts`

**Interfaces:** Produces `StartExaminationError = SchemaValidationError | AppointmentNotFound | InvalidAppointmentState` and a pure `Appointment.startExamination(context)(checkedIn, veterinarianId)` returning `AppointmentExaminationStarted` with `aggregateState: InExamination`.

- [ ] **Step 1: Write RED tests that distinguish error values from event facts**

```typescript
const failed = ensureFound(undefined, appointmentId);
expect(failed.isErr() && failed.error.kind).toBe("AppointmentNotFound");
expect(events).toEqual([]);

const event = Appointment.startExamination(context)(checkedIn, veterinarianId);
expect(event).toMatchObject({
  kind: "AppointmentExaminationStarted",
  aggregateState: { kind: "InExamination" },
  eventName: "appointment.examination-started",
});
```

- [ ] **Step 2: Confirm RED behavior**

Run: `pnpm exercise:09; pnpm exercise:10`

Expected: Session 09 lacks typed guards; Session 10 lacks typed event construction. Neither test imports a repository or store.

- [ ] **Step 3: Implement pure contracts**

```typescript
type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  actualKind: Appointment["kind"];
  expectedKind: "CheckedIn";
}>;

export type AppointmentExaminationStarted = DomainEvent<
  AppointmentId, "Appointment", InExamination,
  "AppointmentExaminationStarted", "appointment.examination-started",
  Readonly<{ appointmentId: AppointmentId; veterinarianId: VeterinarianId }>
>;
```

No error path constructs an event. Do not introduce persistence or `ResultAsync` in this task.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/clinic-session-10 test && pnpm --filter @fp-with-ts/clinic-session-11 test`

Expected: PASS.

```bash
git add examples/session-09 examples/session-10 examples/session-11
git commit -m "feat(examples): separate failures from successful events"
```

### Task 4: Build use-case, atomicity, and safe-follow-up snapshots (11–13)

**Files:**
- Modify: `examples/session-11/**`
- Create: `examples/session-12/**`, `examples/session-13/**`
- Create: `examples/session-11/exercises/use-case-ports.test.ts`, `examples/session-12/exercises/atomicity-and-conflicts.test.ts`, `examples/session-13/exercises/safe-follow-up.test.ts`

**Interfaces:** `StartExaminationUseCase.run` resolves, guards, creates an event, then invokes one store port. `InMemoryAppointmentEventStore.store(event)` atomically updates state and appends the event or returns `AppointmentConflict` / `RepositoryError`. `collectFollowUpTargets` returns targets only; `RequestFollowUpUseCase.run` authorizes, claims, creates the event, and stores it.

- [ ] **Step 1: Write RED tests for sequencing, atomicity, and PII separation**

```typescript
const result = await useCase.run(rawInput);
expect(result.isErr() && result.error.kind).toBe("AppointmentConflict");
expect(store.currentState(appointmentId)).toEqual(checkedIn);
expect(store.events()).toEqual([]);

const targets = collectFollowUpTargets([candidate])._unsafeUnwrap();
expect(targets[0]).not.toHaveProperty("event");
await requestFollowUp.run({ actorUserId: receptionistId, appointmentIds: [appointmentId] });
expect(store.events()[0]?.kind).toBe("FollowUpRequested");
```

- [ ] **Step 2: Confirm RED behavior**

Run: `pnpm exercise:11; pnpm exercise:12; pnpm exercise:13`

Expected: Session 11 lacks asynchronous port composition; Session 12 lacks atomic stale-state rejection; Session 13 leaks targets into events, omits authorization, or accepts duplicate claims.

- [ ] **Step 3: Implement narrow ports and pipeline**

```typescript
export type AppointmentResolver = Readonly<{
  resolveById: (id: AppointmentId) => ResultAsync<Appointment | undefined, RepositoryError>;
}>;
export type ExaminationStartedStore = Readonly<{
  store: (event: AppointmentExaminationStarted) => ResultAsync<void, AppointmentStoreError>;
}>;

return appointmentResolver.resolveById(input.appointmentId)
  .andThen((appointment) => ensureFound(appointment, input.appointmentId))
  .andThen(ensureCheckedIn)
  .map((checkedIn) => Appointment.startExamination(context)(checkedIn, input.veterinarianId))
  .andThrough(examinationStartedStore.store);
```

The in-memory store stages state and event locally, verifies expected prior state, and assigns neither on failure. `FollowUpRequested` contains identifiers only; `OwnerContact` stays in the authorized target/read-model path.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/clinic-session-12 test && pnpm --filter @fp-with-ts/clinic-session-13 test`

Expected: PASS.

```bash
git add examples/session-11 examples/session-12 examples/session-13
git commit -m "feat(examples): add atomic and safe integration sessions"
```

### Task 5: Wire catalog, commands, and Code Explorer to completed snapshots

**Files:**
- Modify: `package.json`, `apps/docs/src/sessions/catalog.ts`
- Modify: `apps/docs/src/code-explorer/project-files.ts`, `apps/docs/src/code-explorer/session-workspaces.ts`, `apps/docs/src/code-explorer/session-workspaces.test.ts`

**Interfaces:** Produces root commands `exercise:00`–`exercise:13` filtering `@fp-with-ts/clinic-session-NN`, and a Code Explorer workspace whose initial file is the session’s exercise.

- [ ] **Step 1: Write catalog and explorer RED assertions**

```typescript
expect(sessions.map((session) => session.sequence)).toEqual([
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "09",
  "10", "11", "12", "13", "Final",
]);
expect(sessionWorkspaceFor("12-atomicity-and-conflicts")).toMatchObject({
  snapshot: "session-12",
  initialFile: "exercises/atomicity-and-conflicts.test.ts",
});
```

- [ ] **Step 2: Confirm the mapping fails**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/session-workspaces.test.ts`

Expected: FAIL because current catalog has only 00–05 and Final.

- [ ] **Step 3: Implement catalog mappings, commands, and import globs**

```typescript
const sessionIdentity = [
  ["00-onboarding", "session-00"], ["01-invariants", "session-01"],
  ["02-state-vocabulary", "session-02"], ["03-state-transitions", "session-03"],
  ["04-awaiting-payment", "session-04"], ["05-cancellation", "session-05"],
  ["06-input-boundary", "session-06"], ["07-meaningful-values", "session-07"],
  ["08-pii-output", "session-08"], ["09-typed-failures", "session-09"],
  ["10-success-events", "session-10"], ["11-use-case-ports", "session-11"],
  ["12-atomicity-and-conflicts", "session-12"], ["13-safe-follow-up", "session-13"],
] as const;
```

Add session 06–13 to `import.meta.glob` and the snapshot tuple. Expose the exercise, direct regression test, and only the files needed for that exercise. Use durations 10, 8, 15, 12, 12, 10, 13, 10, 10, 15, 12, 15, 16, 15, 7 (180 minutes).

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/session-workspaces.test.ts`

Expected: PASS with runnable manifests, local tsconfig, exercise first, and no future source exposed.

```bash
git add package.json apps/docs/src/sessions/catalog.ts apps/docs/src/code-explorer
git commit -m "feat(docs): map explorer to incremental sessions"
```

### Task 6: Author pages, tests, and backward-compatible redirects

**Files:**
- Modify: `apps/docs/src/pages/sessions/00-onboarding.astro`, `apps/docs/src/pages/sessions/final.astro`
- Create: `apps/docs/src/pages/sessions/01-invariants.astro` through `apps/docs/src/pages/sessions/13-safe-follow-up.astro`
- Modify/Create: `apps/docs/src/test/pages/sessions/*.test.ts`
- Modify: `worker/routes.ts`, `worker/routes.test.ts`

**Interfaces:** Every page uses `SessionLayout`, `sessionBySlug`, `CommandBlock`, `SessionCodePlayground`. Existing paths redirect: `01-state-modeling → 02-state-vocabulary`, `02-boundary-and-ids → 06-input-boundary`, `03-result-errors → 09-typed-failures`, `04-agent-review → 13-safe-follow-up`, `05-mini-integration → 13-safe-follow-up`.

- [ ] **Step 1: Write a page RED test for the shared learning contract**

```typescript
expect(page).toContain("pnpm exercise:12");
expect(page).toContain("型で守ること");
expect(page).toContain("統合テストで守ること");
expect(page).toContain("人がレビューすること");
expect(page).toContain("examples/session-12/exercises/atomicity-and-conflicts.test.ts");
```

- [ ] **Step 2: Confirm page tests fail**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/sessions`

Expected: FAIL because new pages and redirects are absent.

- [ ] **Step 3: Write the pages from the sequence**

Each page contains: actor and incident, RED command, files to read, two-function work area, technique plus non-goal, GREEN command, the three verification scopes, reflection, and next link. Use these invariants verbatim:

```text
04: 診察完了と支払完了を混同しない。
10: 失敗を業務イベントとして記録しない。
12: 現在状態と監査イベントを別々に確定しない。
13: PII を含む連絡対象を監査 event に入れず、許可されない操作者へ返さない。
```

Final begins with four incident-to-code routes: state → `appointment.ts`, boundary → `schemaResult.ts`, decision → `startExaminationUseCase.ts`, persistence → `appointmentEventStore.ts`; explain Hono/Inertia/Drizzle only afterward.

- [ ] **Step 4: Add worker redirects and verify**

Run: `pnpm --filter @fp-with-ts/docs test && pnpm --filter @fp-with-ts/docs build && pnpm --filter @fp-with-ts/docs exec vitest run ../../worker/routes.test.ts`

Expected: old paths return redirects, canonical paths return static assets, and every page passes render tests.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/pages/sessions apps/docs/src/test/pages/sessions worker/routes.ts worker/routes.test.ts
git commit -m "feat(docs): teach final design in incremental sessions"
```

### Task 7: Synchronize PRD and event guidance

**Files:**
- Modify: `docs/prd/prd-001.md`, `docs/event/facilitator-guide.md`, `docs/event/participant-setup.md`, `docs/event/troubleshooting.md`, `AGENTS.md`

**Interfaces:** PRD and event material name the 15 catalog entries and 180-minute allocation. `AGENTS.md` names `examples/session-*` and `examples/final`, not the obsolete `packages/clinic-example` tree.

- [ ] **Step 1: Add a consistency test**

```typescript
expect(prd).toContain("AwaitingPayment");
expect(prd).toContain("ResultAsync");
expect(facilitatorGuide).toContain("180分");
expect(agentsGuide).toContain("examples/session-13");
```

- [ ] **Step 2: Confirm it fails before synchronization**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: FAIL until pages, catalog, PRD, and event guides use identical names and commands.

- [ ] **Step 3: Update the guides without scope expansion**

Keep current PRD non-goals: no FP theory survey, library training, event sourcing, or whole-system rewrite. Let the facilitator’s time-shortened route remove implementation in 11–13 but retain observation, invariant selection, and review.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @fp-with-ts/docs test && pnpm --filter @fp-with-ts/docs build`

Expected: PASS.

```bash
git add docs/prd/prd-001.md docs/event AGENTS.md apps/docs/src/test
git commit -m "docs: synchronize final-aligned curriculum guidance"
```

### Task 8: Repair the independent Final redirect regression and run the full gate

**Files:**
- Modify only if focused diagnosis requires it: `examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts`, `examples/final/src/adaptor/primary/web/routes/followUpRoutes.ts`, `examples/final/test/web/clinicFlow.test.ts`

**Interfaces:** injected `AppointmentConflict` and `FollowUpRequestConflict` requests return `303 See Other` with their existing location query strings.

- [ ] **Step 1: Reproduce the known failure in isolation**

Run: `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/web/clinicFlow.test.ts`

Expected: the two known assertions receive `302` where `303` is required; other Final tests pass.

- [ ] **Step 2: Keep the strict route contract as RED**

```typescript
expect(authoritativeConflict.status).toBe(303);
expect(authoritativeConflict.headers.get("location")).toBe(
  `/appointments/${appointment.appointmentId}?error=appointment-conflict`,
);
expect(stale.status).toBe(303);
expect(stale.headers.get("location")).toBe("/follow-ups?error=request-conflict");
```

- [ ] **Step 3: Fix only the boundary that loses explicit 303**

Trace the injected use-case error through the registered route and Inertia middleware. Preserve `context.redirect(location, 303)` in both routes; correct only the layer that changes it to302. Do not weaken tests or modify curriculum files.

- [ ] **Step 4: Run normal and intentional-failure verification**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm --filter @fp-with-ts/docs test:visual`

Expected: all normal checks pass. Then run `pnpm exercise:00` through `pnpm exercise:13`; each fails only for its documented missing contract.

- [ ] **Step 5: Commit the fix separately and publish**

```bash
git add examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts examples/final/src/adaptor/primary/web/routes/followUpRoutes.ts examples/final/test/web/clinicFlow.test.ts
git commit -m "fix(final): preserve see-other conflict redirects"
git push
```

Open or update one draft pull request after the quality gate passes. List the session map, exercises, and separate redirect fix in its description.
