# Session 1 EventStorming Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `startExamination` を題材に、S1のEventStormingからS6のI/O分離まで同じワークフローを段階的に扱う教材へ変更します。

**Architecture:** S1では4件のイベントを事前配置し、診察開始のアクター、コマンド、事前条件を参加者が逆算します。S2〜S6では共通の `StartExaminationWorkflow` 図を再掲し、S3は `AppointmentId` と `VeterinarianId`、S4はHTTP入力から `StartExaminationInput` への変換を演習にします。

**Tech Stack:** Astro 4、TypeScript 5.6、Vitest 2、Zod 3、Excalidraw JSON、pnpm 9

**Spec:** `docs/superpowers/specs/2026-08-29-session-01-eventstorming-workflow-design.md`

## Global Constraints

- S1は15分で、コードを編集しません。
- 参加者が扱うEventStorming記法は、ドメインイベント、アクター、コマンド、Hotspotの4種類です。
- 集約は事前条件の発見後に講師が追加し、状態と業務判断の単位として説明します。
- S3の時間内の課題は `AppointmentId` と `VeterinarianId` の区別です。
- S4の時間内の課題はHTTPの文字列から `StartExaminationInput` を作る境界です。
- `ExamResult`、Pet/Owner/Examの識別子、PIIは時間外の補足へ移します。
- S2〜S6ではアクターの認可を追加しません。
- 各開始スナップショットのexerciseは意図した件数だけ失敗し、solutionスナップショットの回帰テストは成功する状態にします。

---

### Task 1: カリキュラム契約と共通ワークフロー図

**Files:**
- Create: `apps/docs/src/components/StartExaminationWorkflow.astro`
- Modify: `apps/docs/src/styles/sessions.css`
- Modify: `apps/docs/src/session-contracts.test.ts`
- Modify: `apps/docs/src/pages/sessions/02-state-transitions.astro`
- Modify: `apps/docs/src/pages/sessions/03-semantic-identifiers.astro`
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro`
- Modify: `apps/docs/src/pages/sessions/06-effects-and-consistency.astro`

**Interfaces:**
- Consumes: `SessionSummary` と既存の各セッションページ。
- Produces: `StartExaminationWorkflow`。`focus` は `"overview" | "state" | "identifiers" | "boundary" | "errors" | "effects"` を受け取ります。

- [ ] **Step 1: ページメタデータの期待値を先に変更する**

`session-contracts.test.ts` のS1、S3、S4について、次の契約へ変更します。

```ts
expect(session03.peerReview.questions).toContain(
  "`AppointmentId` と `VeterinarianId` を取り違えたコードは、型テストでコンパイルエラーになりますか。",
);
expect(session04.peerReview.questions).toContain(
  "不正な予約IDまたは獣医師IDを含む入力は、`StartExaminationInput` になりませんか。",
);
```

S4のタイトルは「外部入力を境界で検証する」、時間配分は `{ brief: 4, teach: 7, exercise: 12, review: 7 }` のままにします。

- [ ] **Step 2: 契約テストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- session-contracts.test.ts`

Expected: S1、S3、S4の既存メタデータとの差分でFAILします。

- [ ] **Step 3: 共通図とページメタデータを実装する**

`StartExaminationWorkflow.astro` は次の6段を順に表示します。

```text
HTTP input → typed input → load → business decision → domain event → save
```

各段には `data-workflow-step`、強調対象には `data-highlighted="true"` と読み上げ用の「今回の対象」を付けます。S2はbusiness decision、S3はtyped input、S4はHTTP inputとtyped input、S5はloadとbusiness decision、S6はload、domain event、saveを強調します。

各ページの「今回つくるもの」に図を置き、今回扱う範囲を1文で説明します。

- [ ] **Step 4: Docsの契約テストと型検査を通す**

Run: `pnpm --filter @fp-with-ts/docs test -- session-contracts.test.ts`

Expected: PASS

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/components/StartExaminationWorkflow.astro apps/docs/src/styles/sessions.css apps/docs/src/session-contracts.test.ts apps/docs/src/pages/sessions/02-state-transitions.astro apps/docs/src/pages/sessions/03-semantic-identifiers.astro apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/src/pages/sessions/05-workflow-errors.astro apps/docs/src/pages/sessions/06-effects-and-consistency.astro
git commit -m "feat(curriculum): 診察開始の共通ワークフロー図を追加"
```

### Task 2: S1の15分進行とEventStormingテンプレート

**Files:**
- Modify: `apps/docs/src/pages/sessions/01-business-events-and-workflows.astro`
- Modify: `examples/session-01/README.md`
- Modify: `docs/event/session-01-event-storming.excalidraw`
- Modify: `docs/event/facilitator-guide.md`

**Interfaces:**
- Consumes: `StartExaminationWorkflow focus="overview"`。
- Produces: 4件の事前配置イベント、班で追加するアクター・コマンド・Hotspot、事前条件の1文、講師が加える予約集約。

- [ ] **Step 1: S1ページを15分の進行へ変更する**

ページには次の時間区分を明記します。

```text
0:00–1:30 事故と4イベント
1:30–3:00 4種類の付箋
3:00–7:00 アクター、コマンド、事前条件を逆算
7:00–9:00 班比較と予約集約
9:00–12:30 入力、業務判断、出力、境界
12:30–15:00 S2〜S6への接続
```

講師回答としてアクターを固定せず、班の差はHotspotへ残します。事前条件は「受付を済ませた予約だけ、診察を始められます。」とします。

- [ ] **Step 2: Excalidraw JSONを半完成テンプレートへ変更する**

凡例はアクター、コマンド、ドメインイベント、Hotspotの4種類にします。次の4イベントを時系列に事前配置します。

```text
来院が受け付けられた → 診察が開始された → 診察が完了した → 会計が完了した
```

Run: `jq empty docs/event/session-01-event-storming.excalidraw`

Expected: exit 0

- [ ] **Step 3: 参加者READMEと講師進行を同期する**

`examples/session-01/README.md` は参加者が行う3作業と成果物3点を記載します。`facilitator-guide.md` はTAが開始前にボードを開くこと、30秒で印刷カードへ切り替えること、集約を7分経過後に講師が置くことを記載します。

- [ ] **Step 4: DocsテストとExcalidraw JSONを検証する**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASS

Run: `jq empty docs/event/session-01-event-storming.excalidraw`

Expected: exit 0

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/pages/sessions/01-business-events-and-workflows.astro examples/session-01/README.md docs/event/session-01-event-storming.excalidraw docs/event/facilitator-guide.md
git commit -m "feat(session-01): 診察開始の事前条件を発見する進行へ変更"
```

### Task 3: S3を予約IDと獣医師IDの演習へ変更

**Files:**
- Modify: `examples/session-03/src/domain/ids/appointmentId.ts`
- Modify: `examples/session-03/src/domain/ids/veterinarianId.ts`
- Modify: `examples/session-03/src/domain/ids/petId.ts`
- Modify: `examples/session-03/src/domain/ids/ownerId.ts`
- Modify: `examples/session-03/src/domain/appointment/appointment.ts`
- Modify: `examples/session-03/src/domain/appointment/transitions.ts`
- Modify: `examples/session-03/exercises/semantic-identifiers.test.ts`
- Modify: `examples/session-03/exercises/type-fixtures/*`
- Modify: `examples/session-03/src/domain/domain.test-types.ts`
- Modify: `examples/session-03/README.md`
- Modify: `examples/session-04/test/regression/semantic-identifiers.test.ts`
- Modify: `examples/session-04/test/regression/type-fixtures/*`
- Propagate: 同じS3回帰契約を `examples/session-05`、`examples/session-06`、`examples/session-07` へ反映します。

**Interfaces:**
- Consumes: `AppointmentId.schema`、`VeterinarianId.schema`、`CheckedIn`、`startExamination`。
- Produces: `AppointmentId` と `VeterinarianId` が相互代入できず、`startExamination(checkedIn, veterinarianId, startedAt)` の引数が型で区別されるsolution契約。

- [ ] **Step 1: S3のexerciseとsolution回帰テストを新しい識別子へ変更する**

型fixtureは次を検査します。

```ts
const acceptAppointmentId = (_id: AppointmentId): void => undefined;
const acceptVeterinarianId = (_id: VeterinarianId): void => undefined;

// @ts-expect-error VeterinarianId cannot be used as AppointmentId.
acceptAppointmentId(veterinarianId);
// @ts-expect-error AppointmentId cannot be used as VeterinarianId.
acceptVeterinarianId(appointmentId);
```

状態fixtureでは `Scheduled.appointmentId` が `AppointmentId`、`startExamination` の第2引数が `VeterinarianId` であることを検査します。

- [ ] **Step 2: 開始スナップショットのexerciseが新しい理由で失敗することを確認する**

Run: `pnpm exercise:03`

Expected: `AppointmentId` と `VeterinarianId` の区別、予約状態への適用、型テストの3段でFAILします。

- [ ] **Step 3: 開始スナップショットとsolution契約を整える**

session-03では `PetId`、`OwnerId`、`ExamId` を配布済みのbranded typeにします。`AppointmentId` と `VeterinarianId` はUUID検査だけの開始状態にし、予約状態と `startExamination` もそれぞれ素の `string` を使うため、参加者が変更するとsolutionのsession-04へ一致する構成にします。

- [ ] **Step 4: solutionスナップショットの回帰テストを通す**

Run: `pnpm --filter @fp-with-ts/clinic-session-04 test`

Expected: PASS

Run: `pnpm --filter @fp-with-ts/clinic-session-03 typecheck`

Expected: PASS

- [ ] **Step 5: exerciseの失敗を再確認してコミットする**

Run: `pnpm exercise:03`

Expected: 新しい3段の失敗だけを表示します。

```bash
git add examples/session-03 examples/session-04 examples/session-05 examples/session-06 examples/session-07
git commit -m "feat(session-03): 診察開始の識別子を区別する演習へ変更"
```

### Task 4: S4を診察開始入力の境界演習へ変更

**Files:**
- Create: `examples/session-04/src/boundary/startExaminationInput.ts`
- Create: `examples/session-05/src/boundary/startExaminationInput.ts`
- Create: `examples/session-06/src/boundary/startExaminationInput.ts`
- Create: `examples/session-07/src/boundary/startExaminationInput.ts`
- Modify: `examples/session-04/exercises/boundary-and-pii.test.ts`
- Modify: `examples/session-04/src/web/routes.ts`
- Modify: `examples/session-05/src/web/routes.ts`
- Modify: `examples/session-06/src/web/routes.ts`
- Modify: `examples/session-07/src/web/routes.ts`
- Create: `examples/session-05/test/regression/start-examination-input.test.ts`
- Create: `examples/session-06/test/regression/start-examination-input.test.ts`
- Create: `examples/session-07/test/regression/start-examination-input.test.ts`
- Modify: `examples/session-04/README.md`
- Modify: `examples/session-05/README.md`

**Interfaces:**
- Consumes: `AppointmentId.schema`、`VeterinarianId.schema`、`schemaResult`。
- Produces: `StartExaminationInput.parse(raw: unknown): Result<StartExaminationInput>`。

- [ ] **Step 1: solution回帰テストを先に追加する**

```ts
const valid = StartExaminationInput.parse({
  appointmentId: clinicFixture.appointmentId,
  veterinarianId: clinicFixture.veterinarianId,
});
expect(valid.isOk()).toBe(true);
expect(StartExaminationInput.parse({ appointmentId: "invalid", veterinarianId: clinicFixture.veterinarianId }).isErr()).toBe(true);
expect(StartExaminationInput.parse({ appointmentId: clinicFixture.appointmentId, veterinarianId: "invalid" }).isErr()).toBe(true);
```

- [ ] **Step 2: 回帰テストが対象ファイル未作成で失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test -- start-examination-input.test.ts`

Expected: `startExaminationInput` module not foundでFAILします。

- [ ] **Step 3: session-04の意図的に不完全なparserとsession-05以降のsolutionを実装する**

session-04は `raw: any` を検証せず `ok` へ入れます。session-05以降は次のschemaを使います。

```ts
const schema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
}).readonly();

export type StartExaminationInput = z.infer<typeof schema>;
export const StartExaminationInput = {
  schema,
  parse: schemaResult(schema),
} as const;
```

各routeではpath parameterと外部の獣医師ID文字列をこのparserへ渡し、成功値だけを `startExamination` へ渡します。

- [ ] **Step 4: solution回帰を通し、開始exerciseの失敗を確認する**

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test -- start-examination-input.test.ts`

Expected: PASS

Run: `pnpm exercise:04`

Expected: 不正な予約IDと不正な獣医師IDの2件だけがFAILします。

- [ ] **Step 5: S4ページを新しい演習へ変更する**

演習対象を `src/boundary/startExaminationInput.ts` の1ファイルへ変更します。`ExamResult` とPIIは「時間外の補足」に移し、exercise、レビュー質問、失敗件数から外します。

- [ ] **Step 6: session-04からsession-07まで検証してコミットする**

Run: `pnpm --filter @fp-with-ts/clinic-session-04 typecheck`

Run: `pnpm --filter @fp-with-ts/clinic-session-05 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-06 test`

Run: `pnpm --filter @fp-with-ts/clinic-session-07 test`

Expected: すべてPASS

```bash
git add examples/session-04 examples/session-05 examples/session-06 examples/session-07 apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/src/session-contracts.test.ts
git commit -m "feat(session-04): 診察開始入力を検証する演習へ変更"
```

### Task 5: 運営資料とレビュー導線を同期

**Files:**
- Modify: `docs/event/peer-review-card.md`
- Modify: `docs/event/troubleshooting.md`
- Modify: `docs/event/rehearsal-2026-08-15.md`
- Modify: `docs/event/review-sheet.md`
- Modify: `apps/docs/src/pages/sessions/03-semantic-identifiers.astro`
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`

**Interfaces:**
- Consumes: S3の新しい3段、S4の新しい2件の失敗、共通ワークフロー図。
- Produces: 参加者ページ、相互レビュー、トラブル対応、リハーサルの一致した文言。

- [ ] **Step 1: S3とS4のレビュー項目を更新する**

S3は予約IDと獣医師IDの取り違え、予約状態、`startExamination` の引数を確認します。S4は不正な2つのID、`unknown` 入力、成功時だけ型付き入力になることを確認します。

- [ ] **Step 2: exercise失敗件数と復旧手順を更新する**

`troubleshooting.md` と `rehearsal-2026-08-15.md` はS3が新しい3段、S4が不正IDの2件で失敗することを記載します。PIIマスクは時間外の補足として明記します。

- [ ] **Step 3: 全文検索で古い中心課題が残っていないことを確認する**

Run: `rg -n "OwnerId を PetId|外部 JSON は.*ExamResult|PIIマスクの assertion" apps/docs/src/pages/sessions docs/event examples/session-03/README.md examples/session-04/README.md`

Expected: 時間外の補足として意図した記述以外は0件です。

- [ ] **Step 4: Docsテストを通してコミットする**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASS

```bash
git add docs/event apps/docs/src/pages/sessions/03-semantic-identifiers.astro apps/docs/src/pages/sessions/04-boundaries-and-pii.astro
git commit -m "docs(event): S1からS6の診察開始導線を同期"
```

### Task 6: 全体検証とDraft PR

**Files:**
- Verify: repository-wide changes

**Interfaces:**
- Consumes: Task 1〜5のコミット。
- Produces: ビルド可能な教材、意図したexercise失敗、Draft PR。

- [ ] **Step 1: exerciseの失敗契約を確認する**

Run: `pnpm exercise:03`

Expected: 予約IDと獣医師IDに関する意図した失敗だけです。

Run: `pnpm exercise:04`

Expected: 不正な予約IDと不正な獣医師IDに関する2件だけです。

- [ ] **Step 2: 通常検証を実行する**

Run: `pnpm typecheck`

Expected: PASS

Run: `pnpm test`

Expected: PASS

Run: `pnpm build`

Expected: PASS

- [ ] **Step 3: 差分と文章を確認する**

Run: `git diff --check main...HEAD`

Expected: exit 0

設計書の受け入れ条件と実装差分を見比べ、15分の合計、記法4種類、集約を置く時点、S3/S4の中心課題、S2〜S6の共通図を確認します。

- [ ] **Step 4: Draft PRを作成する**

Draft PR本文は「背景」「内容」「論点」の3節にし、exercise:03とexercise:04が教材上意図して失敗することを検証欄へ明記します。
