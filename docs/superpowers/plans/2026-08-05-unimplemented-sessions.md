# 未実装セッション実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `04-agent-review` を CLI から実行できるセッションにし、赤いまま残っている `05-mini-integration` を電話フォロー抽出の実装演習として完結させる。

**Architecture:** `04-agent-review` は新しいドメイン技法を足さず、既存 module の不変条件を `agent-review.ts` の checklist と prompt builder に集約する。`05-mini-integration` は `use-cases.ts` の `collectFollowUpTargets` を実装し、状態、境界、Sensitive、Result、domain event の既存設計を横断して使う。

**Tech Stack:** pnpm, TypeScript, Vitest, Zod, local Result type, Cloudflare Workers docs site

## Global Constraints

- 対象者は TypeScript 初級から中級。基本文法が書ける前提で、複雑な型テクニックは避ける。
- 通常の `pnpm test` はセットアップ確認用として常に緑にする。module 開始時に赤くなるテストは `exercise:*` script で明示的に実行する。
- ドメイン型は `type`、`kind` discriminant、Readonly、Companion Object、関数プロパティ記法を使う。
- `as` は原則禁止。Zod brand または `@ts-expect-error` の型テスト目的以外では使わない。
- PII ログ防御は `Sensitive` runtime wrapper + Zod transform の最小例として扱う。
- ドメインイベントは use case 成功時に記録する最小例として扱う。event sourcing や projection は扱わない。
- `04-agent-review` では新しい原則を増やさず、各 module の Agent Review を横断 checklist にまとめる。
- `05-mini-integration` では参加者が編集する中心を `collectFollowUpTargets` の1関数に絞る。

---

## 現状確認

- `apps/docs/src/content/modules.ts` には `04-agent-review` が存在する。
- root `package.json` と `packages/clinic-example/package.json` には `exercise:04` が存在しない。
- `pnpm exercise:04` は `Command "exercise:04" not found` で失敗する。
- `packages/clinic-example/src/clinic/use-cases.ts` の `collectFollowUpTargets` は `FollowUpTargetNotImplemented` を返す。
- `pnpm test` と `pnpm typecheck` は成功する。
- `pnpm exercise:05` は `expected 'Err' to be 'Ok'` で失敗する。

## File Structure

- Create `packages/clinic-example/src/clinic/agent-review.ts`
  - 04 session の checklist と、05 実装を AI に依頼する prompt builder を持つ。
- Create `packages/clinic-example/exercises/04-agent-review.test.ts`
  - checklist と prompt が、状態、境界、Sensitive、Result、domain event を横断していることを確認する。
- Create `packages/clinic-example/test/04-agent-review.test.ts`
  - 通常テストにも 04 の完成状態を固定する。
- Modify `packages/clinic-example/src/clinic/use-cases.ts`
  - `collectFollowUpTargets` を実装し、必要な入力型とエラー型を追加する。
- Modify `packages/clinic-example/exercises/05-follow-up.test.ts`
  - 成功ケースに加え、検査結果の petId mismatch が Result error になることを確認する。
- Modify `packages/clinic-example/test/05-follow-up.test.ts`
  - 完成後の通常テストに 05 を追加する。
- Modify `packages/clinic-example/package.json`
  - `exercise:04` script を追加する。
- Modify `package.json`
  - root `exercise:04` script を追加する。
- Modify `apps/docs/src/content/modules.ts`
  - 04 の command を `exercise:04` に揃え、05 の編集対象を `collectFollowUpTargets` と明記する。
- Modify `docs/event/facilitator-guide.md`
  - 04 で実行する command と 05 への接続を明記する。
- Modify `packages/clinic-example/README.md`
  - exercise command 一覧に 04 と 05 を追加する。

---

### Task 1: 04 Agent Review をコードで表現する

**Files:**
- Create: `packages/clinic-example/src/clinic/agent-review.ts`
- Create: `packages/clinic-example/exercises/04-agent-review.test.ts`
- Create: `packages/clinic-example/test/04-agent-review.test.ts`
- Modify: `packages/clinic-example/package.json`

**Interfaces:**
- Produces: `ReviewPrincipleKind`
- Produces: `AgentReviewChecklistItem`
- Produces: `agentReviewChecklist: readonly AgentReviewChecklistItem[]`
- Produces: `buildFollowUpAgentPrompt(): string`
- Produces: package script `exercise:04`

- [ ] **Step 1: Write the failing exercise test**

Create `packages/clinic-example/exercises/04-agent-review.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { agentReviewChecklist, buildFollowUpAgentPrompt } from "../src/clinic/agent-review.js";

describe("04 Agent Review", () => {
  test("次の追加要求を依頼する前に、横断レビュー観点をそろえる", () => {
    expect(agentReviewChecklist.map((item) => item.kind)).toEqual([
      "StateTransition",
      "BoundaryValidation",
      "SensitiveData",
      "ResultError",
      "DomainEvent",
    ]);

    const prompt = buildFollowUpAgentPrompt();
    for (const item of agentReviewChecklist) {
      for (const phrase of item.mustMention) {
        expect(prompt).toContain(phrase);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fp-with-ts/clinic-example exercise:04`

Expected: FAIL because `exercise:04` script and `agent-review.ts` do not exist yet.

- [ ] **Step 3: Implement the review model**

Create `packages/clinic-example/src/clinic/agent-review.ts`:

```ts
export type ReviewPrincipleKind =
  | "StateTransition"
  | "BoundaryValidation"
  | "SensitiveData"
  | "ResultError"
  | "DomainEvent";

export type AgentReviewChecklistItem = Readonly<{
  kind: ReviewPrincipleKind;
  question: string;
  mustMention: readonly string[];
}>;

export const agentReviewChecklist: readonly AgentReviewChecklistItem[] = [
  {
    kind: "StateTransition",
    question: "Paid と Canceled を終端状態として扱い、戻る遷移を追加していないか。",
    mustMention: ["Paid", "Canceled", "終端状態"],
  },
  {
    kind: "BoundaryValidation",
    question: "外部から来た検査結果 payload を Zod で parse してから使っているか。",
    mustMention: ["unknown", "Zod", "parse"],
  },
  {
    kind: "SensitiveData",
    question: "ownerEmail や ownerPhone を unwrap してログや戻り値に混ぜていないか。",
    mustMention: ["Sensitive", "unwrap", "ログ"],
  },
  {
    kind: "ResultError",
    question: "失敗理由を throw ではなく Result の error.kind として返しているか。",
    mustMention: ["Result", "error.kind", "throw"],
  },
  {
    kind: "DomainEvent",
    question: "成功した状態変更だけを domain event として記録しているか。",
    mustMention: ["domain event", "成功時", "FollowUpRequested"],
  },
];

export const buildFollowUpAgentPrompt = (): string => [
  "電話フォロー対象を抽出してください。",
  "- Paid / Canceled は終端状態として扱い、終端状態から別状態へ戻す遷移を追加しない",
  "- 外部から来た unknown の検査結果 payload は Zod で parse する",
  "- Sensitive な ownerEmail / ownerPhone を unwrap してログに出さない",
  "- 失敗は throw せず Result の error.kind で返す",
  "- 成功時だけ FollowUpRequested domain event を記録する",
].join("\n");
```

- [ ] **Step 4: Add the normal regression test**

Create `packages/clinic-example/test/04-agent-review.test.ts` with the same assertions as the exercise test:

```ts
import { describe, expect, test } from "vitest";
import { agentReviewChecklist, buildFollowUpAgentPrompt } from "../src/clinic/agent-review.js";

describe("04 Agent Review", () => {
  test("レビュー checklist が次の追加要求の制約を明示する", () => {
    expect(agentReviewChecklist).toHaveLength(5);
    expect(buildFollowUpAgentPrompt()).toContain("FollowUpRequested");
    expect(buildFollowUpAgentPrompt()).toContain("Sensitive");
    expect(buildFollowUpAgentPrompt()).toContain("Result");
  });
});
```

- [ ] **Step 5: Run tests**

Add `exercise:04` to `packages/clinic-example/package.json` scripts before running the exercise command:

```json
{
  "exercise:04": "vitest run --config vitest.exercises.config.ts exercises/04-agent-review.test.ts"
}
```

Run: `pnpm --filter @fp-with-ts/clinic-example exercise:04`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: PASS, including `test/04-agent-review.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/clinic-example/src/clinic/agent-review.ts packages/clinic-example/exercises/04-agent-review.test.ts packages/clinic-example/test/04-agent-review.test.ts packages/clinic-example/package.json
git commit -m "feat: add agent review exercise"
```

---

### Task 2: exercise:04 の CLI 導線を追加する

**Files:**
- Modify: `package.json`
- Modify: `packages/clinic-example/README.md`

**Interfaces:**
- Produces: root script `exercise:04`

- [ ] **Step 1: Add root script**

Modify root `package.json` scripts:

```json
{
  "exercise:04": "pnpm --filter @fp-with-ts/clinic-example exercise:04"
}
```

- [ ] **Step 2: Update README command list**

Modify `packages/clinic-example/README.md`:

````md
# clinic-example

動物病院の予約・カルテ管理システムを題材にしたハンズオン example です。

```bash
pnpm --filter @fp-with-ts/clinic-example test
pnpm --filter @fp-with-ts/clinic-example exercise:00
pnpm --filter @fp-with-ts/clinic-example exercise:01
pnpm --filter @fp-with-ts/clinic-example exercise:02
pnpm --filter @fp-with-ts/clinic-example exercise:03
pnpm --filter @fp-with-ts/clinic-example exercise:04
pnpm --filter @fp-with-ts/clinic-example exercise:05
pnpm --filter @fp-with-ts/clinic-example typecheck
```
````

- [ ] **Step 3: Verify CLI wiring**

Run: `pnpm exercise:04`

Expected: PASS.

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json packages/clinic-example/README.md
git commit -m "chore: wire agent review exercise command"
```

---

### Task 3: 05 Follow-up の失敗型と入力型を決める

**Files:**
- Modify: `packages/clinic-example/src/clinic/use-cases.ts`
- Modify: `packages/clinic-example/exercises/05-follow-up.test.ts`

**Interfaces:**
- Produces: `FollowUpCandidate`
- Produces: `FollowUpExamResult`
- Produces: `ExamResultPetMismatch`
- Produces: `FollowUpTargetError = ValidationError | ExamResultPetMismatch`

- [ ] **Step 1: Write the failing mismatch test**

Append this test to `packages/clinic-example/exercises/05-follow-up.test.ts`:

```ts
test("検査結果の petId が予約の petId と違う場合は Result error を返す", () => {
  const eventStore = createInMemoryDomainEventStore();
  const result = collectFollowUpTargets({
    candidates: [
      {
        appointment: paidAppointment,
        examResult: {
          examId: "exam_999",
          petId: "pet_002",
          collectedAt: NOW,
          needsFollowUp: true,
        },
        ownerContact,
      },
    ],
    eventStore,
  });

  expect(result).toMatchObject({
    kind: "Err",
    error: {
      kind: "ExamResultPetMismatch",
      appointmentId: paidAppointment.id,
      expectedPetId: paidAppointment.petId,
      actualPetId: PetId.schema.parse("pet_002"),
    },
  });
  expect(eventStore.all()).toEqual([]);
});
```

- [ ] **Step 2: Run the exercise to verify it fails**

Run: `pnpm --filter @fp-with-ts/clinic-example exercise:05`

Expected: FAIL because `collectFollowUpTargets` still returns `FollowUpTargetNotImplemented`.

- [ ] **Step 3: Add input and error types**

Modify `packages/clinic-example/src/clinic/use-cases.ts` imports. Change the existing domain-event import to include `FollowUpRequested`, and add type-only imports for the follow-up values:

```ts
import { ExamResult } from "./exam-result.js";
import { ExaminationStarted, FollowUpRequested } from "./domain-events.js";
import type { PetId as PetIdValue } from "./pet-id.js";
import type { OwnerContact } from "./owner-contact.js";
```

Replace the current follow-up types with:

```ts
export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentIdValue;
  ownerPhone: Sensitive<string>;
}>;

export type FollowUpCandidate = Readonly<{
  appointment: AppointmentValue;
  examResult: unknown;
  ownerContact: OwnerContact;
}>;

export type FollowUpExamResult = Readonly<{
  examId: string;
  petId: PetIdValue;
  collectedAt: string;
  needsFollowUp: boolean;
}>;

export type ExamResultPetMismatch = Readonly<{
  kind: "ExamResultPetMismatch";
  appointmentId: AppointmentIdValue;
  expectedPetId: PetIdValue;
  actualPetId: PetIdValue;
}>;

export type FollowUpTargetError = ValidationError | ExamResultPetMismatch;

export type CollectFollowUpTargetsInput = Readonly<{
  candidates: ReadonlyArray<FollowUpCandidate>;
  eventStore: DomainEventStore;
}>;
```

- [ ] **Step 4: Add narrow schema for follow-up extraction**

Add this near the follow-up types in `use-cases.ts`:

```ts
const FollowUpExamResultSchema = ExamResult.schema
  .pick({
    examId: true,
    petId: true,
    collectedAt: true,
    needsFollowUp: true,
  })
  .partial({ needsFollowUp: true })
  .transform((value) => ({
    ...value,
    needsFollowUp: value.needsFollowUp ?? false,
  }));

const parseFollowUpExamResult = schemaResult<FollowUpExamResult>(FollowUpExamResultSchema);
```

This schema intentionally does not require `items`, because module 05 only needs to know whether follow-up is required.

- [ ] **Step 5: Run typecheck to expose missing implementation**

Run: `pnpm --filter @fp-with-ts/clinic-example typecheck`

Expected: FAIL until `collectFollowUpTargets` returns `Result<ReadonlyArray<FollowUpTarget>, FollowUpTargetError>`.

---

### Task 4: collectFollowUpTargets を実装する

**Files:**
- Modify: `packages/clinic-example/src/clinic/use-cases.ts`
- Create: `packages/clinic-example/test/05-follow-up.test.ts`

**Interfaces:**
- Consumes: `FollowUpCandidate`
- Consumes: `FollowUpTargetError`
- Produces: `collectFollowUpTargets(input: CollectFollowUpTargetsInput): Result<ReadonlyArray<FollowUpTarget>, FollowUpTargetError>`

- [ ] **Step 1: Implement pet mismatch helper**

Add this helper in `use-cases.ts`:

```ts
const ensureExamResultForAppointment = (
  appointment: AppointmentValue,
  examResult: FollowUpExamResult,
): Result<FollowUpExamResult, ExamResultPetMismatch> =>
  appointment.petId === examResult.petId
    ? ok(examResult)
    : err({
        kind: "ExamResultPetMismatch",
        appointmentId: appointment.id,
        expectedPetId: appointment.petId,
        actualPetId: examResult.petId,
      });
```

- [ ] **Step 2: Implement the use case**

Replace the current incomplete `collectFollowUpTargets` implementation:

```ts
export const collectFollowUpTargets = (
  input: CollectFollowUpTargetsInput,
): Result<ReadonlyArray<FollowUpTarget>, FollowUpTargetError> => {
  const targets: FollowUpTarget[] = [];

  for (const candidate of input.candidates) {
    const parsed = parseFollowUpExamResult(candidate.examResult);
    if (parsed.kind === "Err") return parsed;

    const matching = ensureExamResultForAppointment(candidate.appointment, parsed.value);
    if (matching.kind === "Err") return matching;

    if (!matching.value.needsFollowUp) continue;
    if (candidate.appointment.kind !== "Paid") continue;

    targets.push({
      appointmentId: candidate.appointment.id,
      ownerPhone: candidate.ownerContact.ownerPhone,
    });
    input.eventStore.append(FollowUpRequested.create({
      eventId: `follow_up_${matching.value.examId}`,
      occurredAt: matching.value.collectedAt,
      appointmentId: candidate.appointment.id,
    }));
  }

  return ok(targets);
};
```

- [ ] **Step 3: Add normal regression test for 05**

Create `packages/clinic-example/test/05-follow-up.test.ts` by copying `packages/clinic-example/exercises/05-follow-up.test.ts`.

The normal test should assert both:

```ts
expect(result.kind).toBe("Ok");
expect(eventStore.all()).toEqual([
  expect.objectContaining({
    kind: "FollowUpRequested",
    appointmentId: paidAppointment.id,
  }),
]);
```

and:

```ts
expect(result).toMatchObject({
  kind: "Err",
  error: { kind: "ExamResultPetMismatch" },
});
```

- [ ] **Step 4: Run exercise and normal tests**

Run: `pnpm --filter @fp-with-ts/clinic-example exercise:05`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: PASS, including `test/05-follow-up.test.ts`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @fp-with-ts/clinic-example typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/clinic-example/src/clinic/use-cases.ts packages/clinic-example/exercises/05-follow-up.test.ts packages/clinic-example/test/05-follow-up.test.ts
git commit -m "feat: implement follow-up target exercise"
```

---

### Task 5: docs と進行ガイドを実装済み導線に揃える

**Files:**
- Modify: `apps/docs/src/content/modules.ts`
- Modify: `docs/event/facilitator-guide.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: root scripts `exercise:04`, `exercise:05`
- Produces: docs module commands that match package scripts

- [ ] **Step 1: Update docs module 04 commands**

Modify the `04-agent-review` entry in `apps/docs/src/content/modules.ts`:

```ts
redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
editTarget: "agentReviewChecklist と buildFollowUpAgentPrompt。",
greenCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
```

- [ ] **Step 2: Update docs module 04 body**

Replace the first section body for `04-agent-review` with:

```ts
body: "これまでの module で見た不変条件を checklist と prompt に変換します。型で守れることと、人がレビューすることを分けてから次の追加要求へ進みます。",
```

- [ ] **Step 3: Update docs module 05 edit target**

Modify the `05-mini-integration` entry:

```ts
editTarget: "collectFollowUpTargets の1関数。",
```

- [ ] **Step 4: Update facilitator guide**

In `docs/event/facilitator-guide.md`, add this bullet under `2:30 総合レビューへ進む`:

```md
- `pnpm --filter @fp-with-ts/clinic-example exercise:04` を実行し、次の追加要求を依頼する前に checklist と prompt を全員で確認する
```

Under `進行上の注意`, add:

```md
- `05-mini-integration` は `collectFollowUpTargets` の1関数に集中し、petId mismatch、PII、Result、domain event の観点をまとめて確認します。
```

- [ ] **Step 5: Update root README flow**

Modify `README.md` 当日の流れ:

```md
6. AI エージェントに次の追加要求を頼む前提でレビューする
7. 電話フォロー対象のミニ総合演習で、既存設計を横断して使う
```

- [ ] **Step 6: Run docs typecheck**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/src/content/modules.ts docs/event/facilitator-guide.md README.md
git commit -m "docs: align unimplemented session guidance"
```

---

### Task 6: 最終検証

**Files:**
- No file changes.

**Interfaces:**
- Consumes: all scripts touched above
- Produces: verified implementation state

- [ ] **Step 1: Run all normal checks**

Run: `pnpm test`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 2: Run every exercise command**

Run:

```bash
pnpm exercise:00
pnpm exercise:01
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
pnpm exercise:05
```

Expected:

- `exercise:04` PASS because the review artifacts are now implemented.
- `exercise:05` PASS after `collectFollowUpTargets` is implemented.
- Existing commands keep their current expected behavior. If a command is intentionally red for the event starter state, document that in the final handoff instead of changing unrelated modules.

- [ ] **Step 3: Inspect git status**

Run: `git status --short`

Expected: no uncommitted changes after the final commit.

- [ ] **Step 4: Final handoff**

Report:

```md
Implemented:
- 04 Agent Review exercise and CLI command
- 05 follow-up target extraction
- Docs and facilitator guidance aligned with scripts

Verified:
- pnpm test
- pnpm typecheck
- pnpm build
- pnpm exercise:04
- pnpm exercise:05
```

---

## Self-Review

- Spec coverage: `04-agent-review` gets a concrete exercise, checklist, prompt, CLI script, docs command, and facilitator note. `05-mini-integration` gets the missing use case implementation, error case, event emission, and regression tests.
- Placeholder scan: The plan contains no open-ended implementation slots. Every code-bearing step includes concrete snippets and expected command results.
- Type consistency: `FollowUpTargetError`, `FollowUpCandidate`, `FollowUpExamResult`, `ExamResultPetMismatch`, and `collectFollowUpTargets` are introduced before later tasks consume them.
