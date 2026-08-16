# PR #37 Railway Workflow Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep unexpected persistence failures as rejected promises, while making the routes and multi-read use cases express only their real, typed workflow outcomes.

**Architecture:** A `ResultAsync<T, never>` has no expected error branch. The web adapter resolves it directly and lets promise rejection reach Hono's existing opaque 500 boundary. Multi-read use cases use `safeTry` to name each successful value and preserve only their existing business-error unions; linear command use cases retain their existing `andThen`/`andThrough` pipelines.

**Tech Stack:** TypeScript 5.9, neverthrow 8.2, Hono, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-final-infrastructure-error-boundary-design.md`

## Global Constraints

- Keep business-state, authorization, concurrency, and validation failures as readonly discriminated unions.
- Do not translate rejected SQLite, schema-validation, or internal-consistency failures to `Err` or `InternalServerError`; they must reach `createApp`'s opaque Hono `onError` response.
- Do not expose the exception message, persisted row, PII, or SQL detail in an HTTP response.
- Keep TypeScript imports relative and suffixed with `.js`.
- Do not alter public learner-facing behavior or add retry/logging infrastructure.
- Do not add `safeTry` to a route that is translating HTTP validation or authorization results into a `Response`.
- This is a behavior-preserving refactor. Add characterization coverage where it is missing, run it before the production refactor, and do not fabricate a failing test for behavior that the existing code already provides.

---

### Task 1: Remove the impossible installation-status error branch

**Files:**
- Create: `examples/final/src/adaptor/primary/web/installationStatus.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/authRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/dashboardRoutes.ts`
- Modify: `examples/final/test/web/authRoutes.test.ts`

**Interfaces:**
- Consumes: `InstallationStatusQuery.get: () => ResultAsync<InstallationStatus, never>`.
- Produces: `resolveInstallationStatus: (query: InstallationStatusQuery) => Promise<InstallationStatus>`.

- [ ] **Step 1: Add Hono-boundary characterization coverage**

Change the infrastructure-failure fixture to return a rejected safe promise, then test the unauthenticated dashboard and each auth route that reads installation status. Use `ResultAsync.fromSafePromise(Promise.reject(privateCause))`; do not construct a typed error that the port no longer allows. Each response must be `500` and its body must not contain `privateCause.message`.

- [ ] **Step 2: Run the focused test before the refactor**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- authRoutes.test.ts`

Expected: PASS; this records that rejected promises already reach the opaque Hono boundary before the unreachable branch is removed.

- [ ] **Step 3: Resolve the no-expected-error result once**

Create the helper with this behavior:

```ts
export const resolveInstallationStatus = (
  query: InstallationStatusQuery,
): Promise<InstallationStatus> =>
  query.get().match(
    (status) => status,
    (error) => assertNever(error),
  );
```

Use it in `authRoutes.ts` and `dashboardRoutes.ts`. Delete all six `installation.isErr()` branches and their `InternalServerError` responses. Do not catch promise rejection: Hono's `app.onError` owns that boundary.

- [ ] **Step 4: Re-run the focused test after the refactor**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- authRoutes.test.ts`

Expected: PASS; ordinary setup/login/dashboard redirects still pass and every injected rejected promise yields an opaque 500.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/adaptor/primary/web/installationStatus.ts examples/final/src/adaptor/primary/web/routes/authRoutes.ts examples/final/src/adaptor/primary/web/routes/dashboardRoutes.ts examples/final/test/web/authRoutes.test.ts
git commit -m "refactor(final): remove impossible installation errors"
```

### Task 2: Express appointment read models with `safeTry`

**Files:**
- Modify: `examples/final/src/useCase/getDashboardUseCase.ts`
- Modify: `examples/final/src/useCase/listAppointmentsUseCase.ts`
- Modify: `examples/final/src/useCase/getAppointmentUseCase.ts`
- Modify: `examples/final/test/useCase/appointmentUseCases.test.ts`

**Interfaces:**
- Consumes: resolver ports that return `ResultAsync<Value, never>` and `ensureUserFound` / `ensureAppointmentFound` typed business checks.
- Produces: unchanged `GetDashboardUseCase`, `ListAppointmentsUseCase`, and `GetAppointmentUseCase` public signatures.

- [ ] **Step 1: Add short-circuit characterization tests**

Add one test for each workflow family that proves an expected `Unauthorized` or `AppointmentNotFound` stops later resolvers, and that a rejected resolver promise is rejected without calling its downstream resolver. Use call counters only for the "was not called" assertion; assert the real `Result` or rejected promise as the primary behavior.

- [ ] **Step 2: Run the focused test before the refactor**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- appointmentUseCases.test.ts`

Expected: PASS; the existing chain already has the required short-circuit behavior and the tests protect it while structure changes.

- [ ] **Step 3: Split collection from projection and use `safeTry`**

In each use case, introduce a private readonly source record and a private loader. The loader uses an async generator to unwrap each port result in order:

```ts
const sources = safeTry<DashboardSources, UnauthorizedError>(async function* () {
  const actor = yield* dependencies.userResolver.resolveById(input.actorUserId);
  yield* ensureUserFound(input.actorUserId)(actor);
  const appointments = yield* dependencies.appointmentListResolver.resolveAll();
  const owners = yield* dependencies.ownerListResolver.resolveAll();
  const pets = yield* dependencies.petListResolver.resolveAll();
  const users = yield* dependencies.userListResolver.resolveAll();
  return ok({ appointments, owners, pets, users });
});
```

Keep `toAppointmentView` and new dashboard/detail projection functions pure. Preserve missing owner/pet presentation as the current empty-array behavior. Do not catch rejections or add error variants.

- [ ] **Step 4: Re-run the focused test after the refactor**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- appointmentUseCases.test.ts`

Expected: PASS; existing role, view-redaction, counts, and appointment-detail assertions remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/useCase/getDashboardUseCase.ts examples/final/src/useCase/listAppointmentsUseCase.ts examples/final/src/useCase/getAppointmentUseCase.ts examples/final/test/useCase/appointmentUseCases.test.ts
git commit -m "refactor(final): clarify appointment read workflows"
```

### Task 3: Clarify follow-up and remaining use-case pipelines

**Files:**
- Modify: `examples/final/src/useCase/listFollowUpsUseCase.ts`
- Modify: `examples/final/src/useCase/requestFollowUpUseCase.ts`
- Modify: every PR #37-touched file under `examples/final/src/useCase/`, except the three Task 2 files, that contains a blank `andThen` callback or a dangling comma left after removing `mapErr(toRepositoryError)`.
- Modify: `examples/final/test/useCase/followUpUseCases.test.ts`

**Interfaces:**
- Consumes: existing business error unions, `FollowUpRequestReader`, `FollowUpResolver`, and `FollowUpRequestedStore` contracts.
- Produces: unchanged public `ListFollowUpsUseCase` and `RequestFollowUpUseCase` signatures with no `RepositoryError` path.

- [ ] **Step 1: Add follow-up workflow characterization tests**

Add a rejected-reader or rejected-resolver test that verifies the promise rejects and that the next resolver/store is not called. Retain the existing tests that assert `FollowUpRequestConflict` and `ExamResultPetMismatch` as typed `Err` values.

- [ ] **Step 2: Run the focused test before the refactor**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- followUpUseCases.test.ts`

Expected: PASS; the existing chain already propagates rejections, and the test holds that contract while the workflow becomes explicit.

- [ ] **Step 3: Use named follow-up sources and preserve linear commands**

Use `safeTry` for `listFollowUpsUseCase.ts` and `requestFollowUpUseCase.ts` so candidate collection, requested-ID lookup, target validation, event creation, and persistence have one named step each. Keep the zero-event branch explicit because it is a valid domain outcome. For the remaining command use cases, retain concise `andThen` and `andThrough` composition; remove only now-redundant blank lines, dangling commas, and removed `RepositoryError` mapping helpers. Do not convert explicit hashing, identity, or session-creation failures from `ResultAsync.fromPromise` into rejected promises.

- [ ] **Step 4: Run focused tests and typecheck to verify GREEN**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- followUpUseCases.test.ts`

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS; typed conflicts retain their existing error kinds, while unexpected reader/resolver/store failures reject.

- [ ] **Step 5: Commit**

```bash
git add examples/final/src/useCase examples/final/test/useCase/followUpUseCases.test.ts
git commit -m "refactor(final): clarify follow-up workflows"
```

## Final Verification

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check`.
- [ ] Confirm `rg -n 'RepositoryError|UseCaseRepositoryError|toRepositoryError' examples/final/src/useCase examples/final/src/adaptor/primary/web` has no matches.
- [ ] Confirm rejection tests assert that the response body does not include the injected private cause.
