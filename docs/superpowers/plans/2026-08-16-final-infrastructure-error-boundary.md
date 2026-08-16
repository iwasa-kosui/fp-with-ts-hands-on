# Final Infrastructure Error Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make examples/final model only business failures with ResultAsync and propagate SQLite / corrupted-persistence failures as exceptions to Hono's top-level error boundary.

**Architecture:** SQLite adapters use ResultAsync.fromSafePromise where no business failure exists, preserving rejections rather than translating them to data. Stores return typed ResultAsync errors only for explicit business conflicts; other failures rethrow. Domain ports, use cases, and web routes no longer expose RepositoryError.

**Tech Stack:** TypeScript 5.9, neverthrow 8.2, Drizzle ORM, Zod, Hono, Vitest.

**Spec:** docs/superpowers/specs/2026-08-16-final-infrastructure-error-boundary-design.md

## Global Constraints

- Keep business-state, authorization, and concurrency failures as readonly discriminated unions.
- Preserve optimistic concurrency and transaction rollback semantics.
- Never send a database cause, persisted row, PII, or SQL detail in an HTTP response or unredacted log.
- Keep relative TypeScript imports suffixed with .js.
- Do not add retry or logging infrastructure.

---

### Task 1: Specify the observable exception boundary

**Files:**
- Modify: examples/final/test/adaptor/sqliteResolver.test.ts:223-410
- Modify: examples/final/test/adaptor/sqliteEventStore.test.ts:220-270
- Modify: examples/final/test/web/authRoutes.test.ts:1-90

**Interfaces:**
- Consumes: real :memory: SQLite from createSqliteDatabase and migrateDatabase.
- Produces: regression coverage for rejection of corrupt data and unknown write failures, retained typed conflict results, and an opaque Hono 500.

- [ ] **Step 1: Write the failing malformed-read test**

Name the test "rejects a corrupt SQLite row instead of modeling it as a use-case error". Insert invalid persisted data through raw SQL, then assert the real resolver rejects with the Zod parsing error:

~~~ts
await expect(createUserListResolver(db).resolveAll()).rejects.toBeInstanceOf(z.ZodError);
~~~

The production mutation it catches is restoring ResultAsync.fromPromise with a RepositoryError mapper.

- [ ] **Step 2: Run the resolver test to verify RED**

Run: pnpm --filter @fp-with-ts/clinic-final test -- sqliteResolver.test.ts

Expected: FAIL because the current resolver fulfills with Err(RepositoryError).

- [ ] **Step 3: Write failing unexpected-write and Hono tests**

For a duplicate event ID, replace the Err assertion with a rejected-promise assertion while retaining the existing rollback assertions:

~~~ts
await expect(store.store(updated)).rejects.toThrow();
expect((await db.select().from(usersTable))[0]?.name).toBe("Before");
~~~

For the Hono composition override, return ResultAsync.fromSafePromise(Promise.reject(new Error("private database cause"))) from installationStatusQuery.get. Assert HTTP 500 and assert that response text does not include the private cause.

- [ ] **Step 4: Run the focused regression tests to verify RED**

Run: pnpm --filter @fp-with-ts/clinic-final test -- sqliteEventStore.test.ts authRoutes.test.ts

Expected: the current duplicate-event and malformed-row behavior conflicts with the new assertions.

### Task 2: Narrow domain port contracts to expected outcomes

**Files:**
- Delete: examples/final/src/domain/aggregate/repositoryError.ts
- Modify: examples/final/src/domain/aggregate/aggregateStore.ts
- Modify: examples/final/src/domain/{appointment,examResult,followUp,owner,pet,session,user}/*Resolver.ts
- Modify: examples/final/src/domain/{appointment,examResult,followUp,owner,pet,user}/*Stores.ts
- Modify: examples/final/src/useCase/query/{eventHistoryReader,followUpRequestReader,installationStatusQuery}.ts

**Interfaces:**
- Consumes: neverthrow ResultAsync.
- Produces: ResultAsync<Success, never> where no expected failure exists, and only business constraints in named store error unions.

- [ ] **Step 1: Change all reader, resolver, and generic aggregate-store signatures**

Remove RepositoryError imports and use the no-expected-error contract:

~~~ts
export type AggregateStore<TEvent extends AnyDomainEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, never>;
}>;

export type InstallationStatusQuery = Readonly<{
  get: () => ResultAsync<InstallationStatus, never>;
}>;
~~~

Apply ResultAsync<Value, never> to every method in the seven resolver files and both non-command query-reader files.

- [ ] **Step 2: Retain named business conflicts only**

Remove RepositoryError from AppointmentStoreError, FollowUpStoreError, the user last-admin constraints, and deletion constraints. Keep the named payloads and ResultAsync<void, StoreError> shape:

~~~ts
export type AppointmentStoreError = AppointmentConflict;
export type FollowUpStoreError = FollowUpRequestConflict;
export type UserUpdatedStoreError = CannotDowngradeLastAdminStoreError;
~~~

- [ ] **Step 3: Type-check the new public contracts**

Run: pnpm --filter @fp-with-ts/clinic-final typecheck

Expected: FAIL at adapters and use cases that still create or map RepositoryError.

### Task 3: Preserve adapter rejections and retain only explicit conflicts

**Files:**
- Modify: examples/final/src/adaptor/secondary/sqlite/query/{eventHistoryReader,followUpRequestReader,installationStatusQuery}.ts
- Modify: examples/final/src/adaptor/secondary/sqlite/resolver/{appointmentResolver,examResultResolver,followUpResolver,ownerResolver,petResolver,sessionResolver,userResolver}.ts
- Modify: examples/final/src/adaptor/secondary/sqlite/store/{appointmentEventStore,examResultEventStore,examinationCompletionStore,followUpEventStore,initialAdminSetupStore,ownerEventStore,petEventStore,sessionEventStore,userEventStore}.ts

**Interfaces:**
- Consumes: the business-only port contracts from Task 2.
- Produces: rejected promises for driver/schema/integrity failures and Err only for parsed business conflicts.

- [ ] **Step 1: Replace generic RepositoryError conversion**

In readers, resolvers, and stores with no expected conflict, replace every ResultAsync.fromPromise(work, repositoryError(operation)) with:

~~~ts
ResultAsync.fromSafePromise(
  Promise.resolve().then(() => /* existing Drizzle read or transaction */),
)
~~~

Do not catch a Drizzle exception, a Zod parse error, or a projection consistency TypeError.

- [ ] **Step 2: Rethrow causes that are not expected transaction conflicts**

Keep the existing local Zod schema that identifies each thrown conflict. Its error mapper must return that conflict or rethrow:

~~~ts
const toAppointmentStoreError = (cause: unknown): AppointmentConflict => {
  const conflict = AppointmentConflictSchema.safeParse(cause);
  if (conflict.success) return conflict.data;
  throw cause;
};
~~~

Use this pattern in appointment, examination-completion, follow-up, initial-admin, owner, pet, session, and user stores. A uniqueness or schema failure must not become a domain variant.

- [ ] **Step 3: Run adapter tests to verify GREEN**

Run: pnpm --filter @fp-with-ts/clinic-final test -- sqliteResolver.test.ts sqliteEventStore.test.ts sqliteInitialAdminSetup.test.ts

Expected: malformed data and duplicate IDs reject; stale state and last-admin tests still get typed Err values.

- [ ] **Step 4: Commit the regression tests and adapter contracts**

~~~bash
git add examples/final/src/domain examples/final/src/adaptor/secondary/sqlite examples/final/test/adaptor
git commit -m "refactor(final): throw unexpected persistence failures"
~~~

### Task 4: Remove the artificial result path from orchestration and web

**Files:**
- Modify: all examples/final/src/useCase/*.ts files that import RepositoryError or define UseCaseRepositoryError
- Modify: examples/final/src/adaptor/primary/web/middleware/useCaseResponse.ts
- Modify: examples/final/src/adaptor/primary/web/routes/{appointmentRoutes,authRoutes,dashboardRoutes,eventRoutes,followUpRoutes,ownerRoutes,petRoutes,userRoutes}.ts
- Modify: examples/final/src/app.ts

**Interfaces:**
- Consumes: ResultAsync<_, never> and business-only store error unions.
- Produces: use-case unions containing only workflow outcomes and one opaque Hono exception boundary.

- [ ] **Step 1: Remove RepositoryError translation from use cases**

Delete RepositoryError imports, UseCaseRepositoryError aliases, toRepositoryError helpers, and .mapErr(toRepositoryError) calls. Where a store mapper only separated a business constraint from RepositoryError, retain the business value directly.

~~~ts
dependencies.userResolver
  .resolveById(input.actorUserId)
  .andThen(ensureUserFound(input.actorUserId));
~~~

Each UseCaseError must now list validation, authorization, not-found, invalid-state, identity, and named conflict cases only.

- [ ] **Step 2: Remove route-level RepositoryError handling**

Delete RepositoryFailure from WebUseCaseError, the RepositoryError arm in respondToUseCaseError, and every route switch arm that maps a RepositoryError to 500. Keep app.onError as the sole opaque response boundary and do not serialize its error.

- [ ] **Step 3: Run workflow and Hono tests to verify GREEN**

Run: pnpm --filter @fp-with-ts/clinic-final test -- startExaminationUseCase.test.ts authenticationUseCases.test.ts followUpUseCases.test.ts authRoutes.test.ts

Expected: existing workflow errors retain their behavior; a rejected installation query reaches the Hono error handler and returns a cause-free 500.

- [ ] **Step 4: Commit orchestration and primary-adapter changes**

~~~bash
git add examples/final/src/useCase examples/final/src/adaptor/primary/web examples/final/src/app.ts examples/final/test
git commit -m "refactor(final): limit result errors to workflow outcomes"
~~~

### Task 5: Synchronize the participant explanation and verify the workspace

**Files:**
- Modify: examples/final/README.md
- Modify: apps/docs/src/pages/sessions/final.astro
- Create: docs/superpowers/specs/2026-08-16-final-infrastructure-error-boundary-design.md
- Create: docs/superpowers/plans/2026-08-16-final-infrastructure-error-boundary.md

**Interfaces:**
- Consumes: the implementation from Tasks 1-4.
- Produces: participant-facing wording that distinguishes expected workflow failures from infrastructure and corrupted-data exceptions.

- [ ] **Step 1: Update Final documentation**

State that expected concurrency conflicts remain workflow results, while malformed persisted rows and driver failures escape adapters and become an opaque HTTP 500 only at Hono's top-level boundary. State that causes and persisted data are not exposed.

- [ ] **Step 2: Run complete verification**

Run:

~~~bash
rg -n "RepositoryError|RepositoryFailure" examples/final/src
pnpm --filter @fp-with-ts/clinic-final typecheck
pnpm typecheck
pnpm test
pnpm build
git diff --check
~~~

Expected: rg has no matches and every other command exits 0.

- [ ] **Step 3: Commit documentation and plan artifacts**

~~~bash
git add examples/final/README.md apps/docs/src/pages/sessions/final.astro docs/superpowers/specs/2026-08-16-final-infrastructure-error-boundary-design.md docs/superpowers/plans/2026-08-16-final-infrastructure-error-boundary.md
git commit -m "docs(final): explain unexpected persistence failures"
~~~
