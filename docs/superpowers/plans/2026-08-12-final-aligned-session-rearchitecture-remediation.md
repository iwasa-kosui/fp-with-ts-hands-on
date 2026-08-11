# Final-aligned Session Rearchitecture Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every public incremental exercise teaches one current decision, can be solved in its declared next snapshot (or has an explicit endpoint exception), and remains editable and verifiable in the documentation site.

**Architecture:** Keep the 00–13 + Final, 180-minute catalog. Repair contracts rather than adding curriculum topics: type distinctions are checked by exercise `tsc`, runtime boundaries call their own parsers, and browser workspaces expose intentionally incomplete local stubs rather than future Final code. The Final remains a non-cumulative read-only reference, while Session 13 explicitly describes the endpoint exception.

**Tech Stack:** TypeScript, Vitest, Astro, React, Monaco, Playwright, Cloudflare Workers.

## Global Constraints

- Preserve the 15 catalog entries `00`–`13` + `Final` and 180 total minutes.
- An ordinary package test must stay green; an exercise must start red only for its documented missing contract.
- For Sessions 01–12, the next snapshot must make the prior exercise green without a different API or a future-topic leak.
- Exercise scripts containing `@ts-expect-error` must run a dedicated exercise TypeScript check before Vitest.
- Browser participants edit at most two existing starter functions; use local stubs, not a create-file UI or copied Final implementation.
- Do not reintroduce `followUpRequestedAt` into appointment state. Follow-up is a successful, authorized event in Session 13/Final.
- Keep Final read-only and structurally independent; make the Session 13 endpoint exception explicit rather than claiming the Final source is a drop-in solution.

---

### Task 9: Repair the early exercise-to-snapshot chain

**Files:**
- Modify: `examples/session-01/exercises/state-modeling.test.ts`, `examples/session-02/src/state-vocabulary.ts`, and any cumulative Session 02 state test needed to preserve the solved invariant.
- Modify: `examples/session-02` through `examples/session-08` `package.json` files and exercise TypeScript configs; create `tsconfig.exercise.json` only where the package has type-level exercise assertions.
- Modify: `examples/session-06/exercises/input-boundary.test.ts`, `examples/session-06/src/domain/startExaminationInput.ts`.
- Modify: `examples/session-07/exercises/value-meaning.test.ts`, `examples/session-07` starter value-object sources.
- Modify: `examples/session-08/exercises/pii-redaction.test.ts`, `examples/session-08/src/domain/ownerContact.ts`.
- Modify: root `package.json` only if an existing `exercise:NN` alias must point at the corrected package script.
- Test: the changed exercise commands and next-snapshot positive tests.

**Interfaces:**
- Consumes: the catalog order `01` state vocabulary, `02` transitions, `03` payment state, `04` cancellation, `05` cancellation starter, `06` input boundary, `07` branded values, `08` PII, `09` redaction.
- Produces: an `exercise` command that runs exercise typecheck then exercise Vitest wherever a type assertion is part of the contract; an exercise for each session that is red in its starter and green in the next snapshot through the public API it teaches.

- [ ] **Step 1: Write failing contract tests before changing a snapshot.**

  Add or adjust tests so they express only the intended contract:

  - Session 01 requires the current invariant `Paid` is terminal, not future `AwaitingPayment`/`Canceled` states; Session 02 exports the state-vocabulary function that makes it pass.
  - Session 06 passes malformed external input to `StartExaminationInput.parse` and expects a typed validation error. It must not call `Appointment.startExamination` with raw input.
  - Session 07 creates distinct `PetId` and `OwnerId` through the declared constructors, uses a `@ts-expect-error` for `PetId` supplied where `OwnerId` is required, and retains one runtime positive path with a valid owner ID. It must not compare erased brands at runtime.
  - Session 08 parses an owner contact through `OwnerContact.parse`, then verifies redaction through JSON, string conversion, and inspect output. It must not stringify an unparsed plain object.

- [ ] **Step 2: Run each new/changed exercise in its starter package and record an expected RED.**

  Run the matching `pnpm exercise:01`, `:06`, `:07`, and `:08` commands. Confirm each failure names the intended missing state helper, parser/validation behavior, branded type contract, or `Sensitive` wrapping—not a broken import path or unrelated type error.

- [ ] **Step 3: Make the next snapshot the minimal GREEN answer.**

  - Keep Session 02 limited to its three vocabulary states while exporting its terminal-state invariant helper; do not introduce payment/cancellation states early.
  - Give Sessions 06–08 local, deliberately incomplete stubs for the parser/value/contact functions so their browser workspace has an existing file to edit. The next snapshots 07–09 provide the completed versions through the same exported API.
  - Do not put raw-input Zod validation inside the appointment transition, do not use runtime assertions to prove TypeScript brands, and do not redact arbitrary unparsed records.

- [ ] **Step 4: Make the exercise command enforce type assertions.**

  For every package whose exercise includes `@ts-expect-error`, add an exercise-only `tsconfig` that includes the exercise file and required source, and run `tsc --noEmit -p tsconfig.exercise.json` before the existing exercise Vitest invocation. Keep normal `test` and normal `typecheck` free of intentionally failing exercises.

- [ ] **Step 5: Verify both sides of every repaired boundary.**

  Run each repaired exercise in the starter (RED), then run its corresponding test/contract in the next snapshot (GREEN). Run `pnpm exercise:00` through `pnpm exercise:13` and confirm every command exits nonzero for its documented starter gap. Run the normal tests and typecheck for Sessions 01–09 plus root `pnpm typecheck` and `pnpm test`.

- [ ] **Step 6: Self-review and commit.**

  Confirm no exercise imports Final source, no future state is named before its catalog session, and error messages guide the declared two-function edit. Commit only the early exercise-chain repair.

### Task 10: Make later workspaces editable and synchronize session artifacts

**Files:**
- Modify: `examples/session-06` through `examples/session-13` appointment models to remove the unused `followUpRequestedAt` field from `Canceled` and cancellation input.
- Modify/Create: Session 09–12 local starter modules referenced by their exercises (`ownerContact`, typed-error/event, resolver/store/use-case modules as applicable), using minimal explicit `TODO`-free stubs that fail the intended contract.
- Modify: `apps/docs/src/code-explorer/session-workspaces.ts`, `apps/docs/src/code-explorer/session-workspaces.test.ts`, and any workspace file-list fixture.
- Modify: `examples/session-00/README.md` through `examples/session-13/README.md` and add/update a focused README/curriculum contract test.
- Modify: Session 13 README/page copy if needed to state that its starter is solved locally and Final is a read-only comparison, not a mechanically compatible next snapshot.
- Test: Code Explorer workspace contracts, affected session normal tests/exercises, README contract test, docs tests, and browser E2E.

**Interfaces:**
- Consumes: Task 9 starter APIs and the existing Code Explorer `visibleFiles` contract.
- Produces: every Session 06–12 exercise target is an editable existing file in its own workspace; Session 13 has an explicit endpoint exception; appointment state has no early follow-up marker.

- [ ] **Step 1: Add failing workspace and content-contract tests.**

  Extend the exact visible-file contracts to require every direct starter edit target used by Sessions 06–12 exercises. Add a README contract test requiring the catalog-correct title and these ordered headings: `開始状態`, `この回で変える関数`, `検証`, `次の snapshot`. Add a regression test that the appointment cancellation type has no `followUpRequestedAt` member.

- [ ] **Step 2: Run the focused docs/session tests and confirm RED.**

  Confirm missing workspace files, shifted README titles/headings, and the leaked follow-up property fail the new checks for the stated reason.

- [ ] **Step 3: Add local starter files and remove the future leak.**

  Expose only intentionally incomplete sources directly imported by the current exercise. Each must have the documented function name and a safe placeholder that causes the current exercise to fail, not a copied Final implementation. Remove `followUpRequestedAt` from Sessions 06–13 and their fixtures, preserving cancellation tests. Leave follow-up creation exclusively in the Session 13 event/use-case path.

- [ ] **Step 4: Normalize the local guides and endpoint wording.**

  Make every `00`–`13` README use its catalog title and required ordered headings. Correct the shifted `06`–`10` titles. Explain in Session 13 that participants make its local starter green; Final is a read-only architectural tour and comparison, so it is intentionally not a source-compatible answer.

- [ ] **Step 5: Verify participant-facing behavior.**

  Run Code Explorer and README contract tests, normal/exercise tests for Sessions 06–13, docs test, and `pnpm --filter @fp-with-ts/docs test:visual`. Confirm every public playground has visible editable targets, a real editor taller than 200px, accessible run/reset controls, and no Final-source leakage.

- [ ] **Step 6: Self-review and commit.**

  Check that stubs do not exceed two participant edit functions, no optional follow-up state survives, and the user-facing session names match `catalog.ts`. Commit only workspace/model/document coherence changes.

### Task 11: Close deployed-route and Final-reference contracts

**Files:**
- Modify: `wrangler.jsonc`, `worker/routes.test.ts` or the focused deployed-routing configuration test.
- Modify: `docs/prd/prd-001.md`, relevant Final/Session 13 public page copy and their source-contract tests.
- Test: Worker routing configuration tests, PRD/page guidance tests, docs build, root quality gates.

**Interfaces:**
- Consumes: existing `resolveWorkerRoute` Session 00 redirects and Task 10 endpoint wording.
- Produces: every legacy route resolved by the Worker is also routed to it in production; PRD uses one consistent Final contract.

- [ ] **Step 1: Write failing deployment and wording tests.**

  Add the two legacy Session 00 paths from `worker/routes.ts` to the expected `assets.run_worker_first` test set. Add a guidance test that Final is described only as a read-only reference tour and that the final hands-on correction/assessment occurs in Session 13.

- [ ] **Step 2: Run focused tests to confirm RED.**

  The deployed route set must omit the two paths before the configuration change; the PRD/page assertion must expose the incompatible `最終演習` wording.

- [ ] **Step 3: Apply the minimal production/document fixes.**

  Include exactly the two legacy Session 00 paths in `assets.run_worker_first`. Rewrite PRD and page text so Final requires comparison and explanation only; locate any local modification, measurement, or acceptance activity in Session 13. Do not change the catalog duration or add a session.

- [ ] **Step 4: Verify and commit.**

  Run worker tests, docs guidance tests, `pnpm --filter @fp-with-ts/docs build`, root `pnpm typecheck`, `pnpm test`, `pnpm build`, and the visual suite. Commit only deployed-route and Final-contract coherence changes.

## Plan Review

- Exercise-chain requirements from the final audit map to Task 9; local editability, model leak, README correction, and endpoint clarification map to Task 10; production Worker reachability and the PRD contradiction map to Task 11.
- No task adds a session, a new dependency, a file-creation UI, or a Final implementation copy. The catalog and teaching scope remain unchanged.
- The plan contains no deferred placeholders. Each task ends with a focused review gate and then the existing full-branch review must be rerun.
