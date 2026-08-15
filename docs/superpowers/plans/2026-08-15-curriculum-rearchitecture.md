# Curriculum Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #36 の設計を、最新化した PRD、5つの開始スナップショットと到達点、catalog 駆動の参加者サイト、班内相互レビューを含む運営文書として実装する。

**Architecture:** `examples/session-00`〜`session-05` を「素朴な開始点 → 次スナップショットの解答」という連鎖に再構築し、各演習の回帰テストを次スナップショットへ持ち越す。`apps/docs` は `catalog.ts` を時間・演習範囲・判断・相互レビューの唯一の真実とし、静的な Astro コンポーネントと構造テストから各セッションを組み立てる。`examples/final` は凍結し、当日の到達点とは分離する。

**Tech Stack:** TypeScript 5.9、pnpm 9、Vitest 2、Zod 3、neverthrow 8、Astro 4、React 18、WebContainer、Cloudflare Worker。

## Global Constraints

- 開催は 180 分、オフライン、5 人 1 班＋各班 TA 1 名。固定枠 30 分、セッション枠 150 分とする。
- コーディングエージェントは推奨だが必須ではない。ローカル clone を主線、Playground を説明用・退避先とする。
- 演習は S1〜S4 の 4 本。各演習は 1 モジュール、最大 4 ステップ、最大 3 判断点、最大 5 ファイル・実効 80 行とする。
- 各演習は ADV（言語化 → 委譲 → 個人検証）と班内相互レビューを持つ。相互レビューは S1/S2 が 7 分、S3/S4 が 8 分、原則 2 名を比較する。
- 時間内訳は S0=15、S1=30、S2=30、S3=35、S4=35、Final=5 分。`brief + teach + exercise + review === durationMinutes`、全セッション合計は 150 分とする。
- ADV は S1=2+9+2、S2=2+8+2、S3=2+10+3、S4=2+10+3 分とする。
- 予約状態は `Scheduled | CheckedIn | InExamination | Paid | Canceled` の 5 状態とし、`AwaitingPayment` を導入しない。
- `examples/session-05` は到達点スナップショットであり catalog へ載せない。`examples/final/**` は一切変更しない。
- 通常テストと演習テストを分離する。演習の RED はモジュール解決エラーではなく、業務の言葉で命名された assertion failure にする。
- 外部入力は Zod、ID は branded type、予期可能な失敗は `Result`、副作用境界は port、非同期保存は `ResultAsync` と `andThrough` を使う。
- 相対 import は `.js` suffix、データは `Readonly`、エラーと状態は判別共用体、遷移は純粋関数とする。
- 個人情報は `Sensitive<T>` で保護し、`JSON.stringify`、`console.log`、`util.inspect` で `[REDACTED]` とする。
- トップページの見た目・文章・情報量・主要導線と `e2e/home.spec.ts` のスクリーンショットは変更しない。
- Content Collections、MDX、外部 CMS、新しいサーバー実行基盤、参加者コードの永続化、特定エージェント製品への依存は導入しない。
- 旧 `/sessions/04-agent-review/` と `/sessions/05-mini-integration/` は `/sessions/04-effects-and-events/` へ恒久リダイレクトする。
- 会場ディスプレイは未確認である。運営文書は外部ディスプレイを第一案、ラップトップを島の中央へ置き 1 ファイル 20 行以内を映す方法を退避案として併記し、確認済みとは書かない。
- `docs/prd/prd-001.md` は過去の構成を保存する資料ではなく、今回の再設計後の正式な要件とする。章全体を監査し、旧6セッション、独立エージェントレビュー、ミニ総合演習、最大2関数、旧時間配分、旧演習コマンド、旧到達点に依存する記述を残さない。
- 各実装フェーズは task review を通過してから controller が push する。push 境界は Plan、P0、P1、P2、P3、P4 の 6 回とする。

---

### Task 1: P0 — 要件とリポジトリ指針を新制約へ移行する

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/docs/AGENTS.md`
- Modify: `docs/prd/prd-001.md`

**Interfaces:**
- Consumes: PR #36 の設計 §0、§1、§3、§7.1、§7.2。
- Produces: P1〜P3 が従う最新の PRD 全文、正式な PRD-06、PRD-13、PRD-14 と、実在パスを指す作業ガイド。

- [ ] **Step 1: PRD の旧制約を列挙する**

Run:

```bash
rg -n '最大2関数|最大 2 関数|2関数|2 関数|ミニ総合演習|エージェントレビュー' docs/prd/prd-001.md AGENTS.md apps/docs/AGENTS.md
```

Expected: `prd-001.md` のエグゼクティブサマリー、学習ループ、体験設計、PRD-06、制約、リスク、リリース判定と、ルート `AGENTS.md` の教材不変条件が列挙される。

- [ ] **Step 2: PRD-06 を置換し PRD-13/14 を追加する**

PRD-06 は次の文にする。

```text
コード編集を行うモジュールでは、参加者の編集範囲を1モジュール（最大5ファイル・実効80行）に限定し、進行を最大4ステップ、下す設計判断を最大3件に制限する
```

PRD-13 と PRD-14 は次の文にする。

```text
PRD-13: コード編集を行うモジュールでは、参加者が (a) 守る不変条件の1文、(b) 依頼文、(c) 型で守れなかった残り、の3つを成果物として残す。
PRD-14: コード編集を行うモジュールでは、班内の相互レビューを1回行う。TA が班から1〜2名の差分をピックアップし、班の全員が同じ画面を見て、不変条件が型で守られているか実行時の分岐で守られているかを判定する。参加者へ投げる問いをあらかじめ定義しておく。
```

PRD の学習ループは「不変条件を依頼文に落とす」「生成差分を型とテストに照らしてレビューする」を含め、モジュール表は S0〜S4 と Final に同期する。PRD-01〜05、PRD-07〜12 は番号を機械的に温存するのではなく、再設計後も有効な意図を維持したうえで文面・判定方法を更新する。`AIエージェントは主目的にしない` の原則は維持する。

- [ ] **Step 3: PRD 全章を再設計後の実体へ同期する**

`docs/prd/prd-001.md` のエグゼクティブサマリー、対象参加者、行動変容、ゴール/非ゴール、体験設計、プロダクト要件、品質要件、成功指標、計測計画、制約、リスク、リリース判定、プロダクト原則を PR #36 の設計と章ごとに照合する。次を正規の契約として本文へ反映する。

```text
教材セッション: S0 15分 / S1 30分 / S2 30分 / S3 35分 / S4 35分 / Final 5分
時間総額: セッション150分 + 固定枠30分 = 180分
予約状態: Scheduled / CheckedIn / InExamination / Paid / Canceled
演習コマンド: pnpm exercise:01 〜 pnpm exercise:04
到達点: examples/session-05（単一集約の ResultAsync pipeline）
参照実装: examples/final（当日は5分の講師ツアー、参加者は環境構築しない）
共通手順: 言語化 → 委譲 → 個人検証 → 班内相互レビュー
相互レビュー: S1/S2 7分、S3/S4 8分、原則2名の差分を比較、時間超過時のみ1名へ落とす
```

独立した「エージェントレビュー」と「ミニ総合演習」はモジュール表から削除し、前者の成果物は全4演習の ADV/相互レビューへ移したと明記する。成功指標の目標割合など再設計と無関係な数値は根拠なく変えず、判定方法だけが旧構成に依存する場合は新成果物（不変条件、依頼文、型で守れなかった残り、レビュー観点シート）へ更新する。

- [ ] **Step 4: AGENTS.md 2 本の実在パスと教材制約を直す**

ルート側は `packages/clinic-example/**` を `examples/session-0N/**` へ置換し、教材不変条件へ次を追加する。

```text
参加者が編集する範囲は、1演習につき1モジュール（1ディレクトリ）に閉じる。進行は最大4ステップ、設計判断は最大3件、解答差分は最大5ファイル・実効80行に保つ。
各演習は「不変条件の言語化 → 依頼文への変換 → 差分のレビュー」の3手順を持ち、3つの成果物が残る形にする。差分のレビューは個人で閉じず、班内相互レビュー（7〜8分）を1回持つ。
```

docs 側は `modules` 語彙と実在しない `src/pages/modules` / `src/modules/catalog.ts` を `sessions`、`src/pages/sessions`、`src/sessions/catalog.ts` へ置換し、トップページ保護と視覚検証ルールは維持する。

- [ ] **Step 5: 文書整合性を検証する**

Run:

```bash
rg -n '最大2関数|最大 2 関数|packages/clinic-example|src/pages/modules|src/modules/catalog|04-agent-review|05-mini-integration|exercise:00|exercise:05' docs/prd/prd-001.md AGENTS.md apps/docs/AGENTS.md
pnpm test
```

Expected: `rg` は 0 件、`pnpm test` は成功。既存テスト件数を報告へ記録する。

- [ ] **Step 6: P0 を commit する**

```bash
git add AGENTS.md apps/docs/AGENTS.md docs/prd/prd-001.md
git commit -m "docs: 教材スコープと相互レビュー要件を更新"
```

Controller gate: task review 承認後に `git push origin main-a5cflu`。

---

### Task 2: P1-A — S0〜S2 の開始点と解答連鎖を再構築する

**Files:**
- Rewrite: `examples/session-00/**`
- Rewrite: `examples/session-01/**`
- Rewrite: `examples/session-02/**`
- Create/Rewrite: `examples/session-03/src/domain/appointment/**`
- Create/Rewrite: `examples/session-03/src/domain/ids/{appointmentId,examId,ownerId,petId,veterinarianId}.ts`
- Create/Rewrite: `examples/session-03/src/boundary/{examResult,ownerContact}.ts`
- Create/Rewrite: `examples/session-03/src/shared/{schemaResult,sensitive}.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: P0 の正式な制約、5状態の appointment model。
- Produces: S1/S2 の intentionally-red exercise と、`session-02` / `session-03` にある緑の解答・回帰テスト。Task 3 はこの型と fixture をそのまま引き継ぐ。

- [ ] **Step 1: 全スナップショット共通設定の失敗を先に固定する**

各 `tsconfig.json` の `include` に次を含めることを検証するテストまたは既存 typecheck 条件を先に追加し、変更前に失敗を確認する。

```json
[
  "src/**/*.ts",
  "test/**/*.ts",
  "exercises/**/*.ts",
  "vitest.config.ts",
  "vitest.exercises.config.ts"
]
```

`package.json` は `build` script を持たず、S2 以降に `zod` と `@types/node` を宣言する。通常 `test` は `test/**`、`exercise` は `exercises/**` だけを実行する。

- [ ] **Step 2: S0 の legacy と事故観察を実装する**

`session-00/src/legacy/appointment.ts` と `logger.ts` へ現行素材を移し、`status: string`、optional な状態付随値、全 ID が `string`、予期可能失敗の `throw`、予約全体のログ出力という 5 つの弱点を保持する。`exercise` script と `exercises/` は削除し、`test/setup.test.ts` は通常フローの環境確認として成功させる。

- [ ] **Step 3: S1 の RED を書いて assertion failure を確認する**

`session-01/exercises/state-modeling.test.ts` は 4 つの `describe` を持つ。

```ts
describe("Step 1: 会計済みの来院は診察を開始できない", () => {
  it("Paid を渡す呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("s1-paid-cannot-start.ts")).toEqual([]);
  });
});
describe("Step 2: キャンセルには必ず理由を残す", () => {
  it("reason を省いた呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("s1-cancel-requires-reason.ts")).toEqual([]);
  });
});
describe("Step 3: 全遷移の入口を状態型で絞る", () => {
  it("許可されない遷移元はコンパイルできない", () => {
    expect(compileTypeFixture("s1-transition-sources.ts")).toEqual([]);
  });
});
describe("Step 4: 状態追加時に表示分岐を見直す", () => {
  it("6つ目の状態を足すと status label がコンパイルできない", () => {
    expect(compileTypeFixture("s1-status-exhaustive.ts")).toEqual([]);
  });
});
```

`compileTypeFixture` は TypeScript compiler API で `exercises/type-fixtures/*.ts` を no-emit compile し、診断メッセージを返す test helper とする。fixture 内に `@ts-expect-error` を置くことで、starter では unused directive の診断により Vitest assertion が赤になり、解答 snapshot では診断 0 件になる。exercise 自体は通常 `pnpm typecheck` を壊さない。

`session-01/src/domain/appointment/appointment.ts` は 5 状態 union を完成形で配布し、`transitions.ts` は `Appointment` 引数・`throw`・`as Appointment` を使う素朴版、`statusLabel.ts` は `default: return "不明"` を使う素朴版にする。starter は RED を成立させる教材 fixture なので exercise より先に実在させ、その後に exercise の assertion failure を確認してから次 snapshot の解答を実装する。

Run: `pnpm exercise:01`

Expected: モジュール解決ではなく Step 1〜4 の assertion が意図通り失敗する。

- [ ] **Step 4: S1 の解答を session-02 に実装して GREEN を確認する**

解答 API は次とする。

```ts
type RecordPaymentInput = Readonly<{ diagnosis: string; treatment: string; amount: number }>

checkIn: (appointment: Scheduled, checkedInAt: string) => CheckedIn
startExamination: (appointment: CheckedIn, veterinarianId: string, examinationStartedAt: string) => InExamination
recordPayment: (appointment: InExamination, input: RecordPaymentInput, paidAt: string) => Paid
cancel: (appointment: Scheduled | CheckedIn, reason: CancellationReason, canceledAt: string) => Canceled
toStatusLabel: (appointment: Appointment) => string // default を持たず assertNever
```

遷移は純粋関数とし、解答内で `Date` や `crypto` を呼ばない。時刻は呼び出し側が文字列で渡し、`Paid` の診断・処置・金額は `RecordPaymentInput` でまとめて渡す。`CancellationReason` は S1 では必須引数であることを示す `string` alias とし、S2 で外部入力境界と PII の扱いを加える。

戻り値は `as const satisfies <State>` とし、`as Appointment` は使わない。S1 exercise を `session-02/test/regression/state-modeling.test.ts` へ持ち越して通常 test として成功させる。

Run:

```bash
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-02 typecheck
```

Expected: S1 回帰を含めて成功。

- [ ] **Step 5: S2 の RED を書いて assertion failure を確認する**

`session-02/src/boundary/` は `raw: any` と手書き型を使う素朴版、`boundary.test-types.ts` は空で配布する。モジュール外には完成済みの `Sensitive<T>`、`schemaResult`、5 種の branded ID を置き、変更対象にしない。

`session-02/exercises/boundary-and-ids.test.ts` は 4 つの `describe` を持つ。

```ts
describe("Step 1: 形の違う検査 JSON はドメイン型にならない", () => {
  it("petId がない JSON は err になる", () => {
    expect(parseExamResult({ examId: EXAM_ID, items: [] }).isErr()).toBe(true);
  });
});
describe("Step 2: 電話番号とメールはログへ出ない", () => {
  it("JSON と util.inspect のどちらも値をマスクする", () => {
    const contact = parseOwnerContact(VALID_CONTACT)._unsafeUnwrap();
    expect(JSON.stringify(contact)).not.toContain("090-0000-0000");
    expect(inspect(contact)).toContain("[REDACTED]");
  });
});
describe("Step 3: schema とドメイン型がずれない", () => {
  it("schema が返す値をそのまま OwnerContact として使える", () => {
    expectTypeOf(parseOwnerContact(VALID_CONTACT)._unsafeUnwrap()).toMatchTypeOf<OwnerContact>();
  });
});
describe("Step 4: 異なる種類の ID はコンパイルで止まる", () => {
  it("OwnerId を PetId の位置へ渡せない", () => {
    expect(compileTypeFixture("s2-owner-id-is-not-pet-id.ts")).toEqual([]);
  });
});
```

Run: `pnpm exercise:02`

Expected: 不正 JSON と PII マスクの assertion failure。型禁止は `@ts-expect-error` と `pnpm typecheck` で確認できる。

- [ ] **Step 6: S2 の解答を session-03 に実装して GREEN を確認する**

境界 API は `raw: unknown` を受け、Zod schema と `schemaResult` から `Result` を返す。ID は用途別 brand、連絡先は `.brand().transform(Sensitive.of)`、型は `z.infer<typeof Schema>` から導出する。`Sensitive<T>` は `toJSON`、`toString`、Node inspect hook で `[REDACTED]` を返し、明示的な `unwrap()` だけが元値を返す。

S2 exercise を `session-03/test/regression/boundary-and-ids.test.ts` へ持ち越す。

Run:

```bash
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
```

Expected: 不正 JSON は `err`、ID 取り違えはコンパイルエラー、JSON と inspect は `[REDACTED]`。

- [ ] **Step 7: README と fixture 規約を同期して commit する**

各 README は「このディレクトリは Session NN の開始スナップショット。解答は `session-0(N+1)/src`」と明記する。直値 fixture を増やさず、共有 fixture から同じ UUID・時刻を使う。

```bash
git add examples/session-00 examples/session-01 examples/session-02 examples/session-03 pnpm-lock.yaml
git commit -m "feat: 状態と境界の演習スナップショットを再構築"
```

---

### Task 3: P1-B — S3〜S5 と root exercise 契約を再構築する

**Files:**
- Rewrite: `examples/session-03/**`
- Rewrite: `examples/session-04/**`
- Rewrite: `examples/session-05/**`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Phase-gate sync: `apps/docs/src/code-explorer/{session-workspaces,onboarding-guides}.ts`
- Phase-gate sync: `apps/docs/src/code-explorer/{session-workspaces,onboarding-guides}.test.ts`
- Phase-gate sync: `apps/docs/src/test/pages/code-explorer.test.ts`
- Phase-gate sync: `apps/docs/src/test/pages/sessions/code-playground.test.ts`

**Interfaces:**
- Consumes: Task 2 の appointment、ID、boundary、`Sensitive`、`schemaResult` と回帰テスト。
- Produces: 同期 `Result` の S3、非同期 `ResultAsync` の S4、全解答を含む `session-05` 到達点、root の exercise 01〜04 契約。

- [ ] **Step 1: S3 の RED を書く**

`session-03/src/useCase/errors.ts` は次の union と未実装の絞り込み関数本体を持つ。

```ts
type AppointmentNotFound = Readonly<{ kind: "AppointmentNotFound"; appointmentId: AppointmentId }>;
type InvalidAppointmentState = Readonly<{ kind: "InvalidAppointmentState"; actual: Appointment["kind"] }>;
type StartExaminationError = AppointmentNotFound | InvalidAppointmentState;
```

`startExamination.ts` は同期 resolver、`throw`、try/catch を使う素朴版にする。exercise は `ensureCheckedIn`、`ensureAppointmentFound`、`andThen` pipeline、失敗時に遷移しない fake-port test の 4 `describe` に分ける。

Run: `pnpm exercise:03`

Expected: 予約なしと状態不正が例外または誤った戻り値になり、業務名の assertion が失敗する。

- [ ] **Step 2: S3 の解答を session-04 に実装する**

```ts
ensureAppointmentFound: (appointment: Appointment | undefined) => Result<Appointment, AppointmentNotFound>
ensureCheckedIn: (appointment: Appointment) => Result<CheckedIn, InvalidAppointmentState>
startExamination: (deps: Dependencies) => (input: StartExaminationInput) => Result<InExamination, StartExaminationError>
```

pipeline は `ok/err` と `andThen` で合成し、予期可能失敗に `throw` を使わない。S3 exercise を `session-04/test/regression/result-errors.test.ts` へ持ち越し、fake port で失敗時に遷移関数または保存が呼ばれないことを観察可能にする。

- [ ] **Step 3: S4 の RED を書く**

`session-04/src/useCase/startExamination.ts` は Task 3 Step 2 の同期 `startExamination` pipeline をそのまま残し、S4 用に別名の `startExaminationWithEffects` を配布する。この弱い効果付き経路だけが `Date` / `randomUUID` と `stateStore` + `eventLog` の dual-write を持つ。`dependencies.ts` は S3 の `Dependencies` を残したうえで、分離した2 write portを持つ `EffectsDependencies` を追加する。`Appointment.startExamination(context)(checkedIn, veterinarianId)` companion は `session-04` のドメインへあらかじめ配布し、`session-05` と同一にする。

exercise は次の 4 `describe` に分ける。

```ts
describe("Step 1: 同じ clock と ID generator なら同じイベントになる", () => {
  it("固定 context から同じ eventId と occurredAt を返す", async () => {
    const result = await startExaminationWithEffects(fixedDependencies)(VALID_INPUT);
    expect(result._unsafeUnwrap()).toMatchObject(FIXED_IN_EXAMINATION);
  });
});
describe("Step 2: 状態と監査記録は1回の保存で残る", () => {
  it("store(event) を1回だけ呼ぶ", async () => {
    await startExaminationWithEffects(recordingDependencies)(VALID_INPUT);
    expect(recordedEvents).toHaveLength(1);
  });
});
describe("Step 3: 非同期保存後もイベントが pipeline に残る", () => {
  it("保存成功時は store の void ではなく aggregateState を返す", async () => {
    const result = await startExaminationWithEffects(recordingDependencies)(VALID_INPUT);
    expect(result._unsafeUnwrap().kind).toBe("InExamination");
  });
});
describe("Step 4: 保存失敗時は状態も記録も残らない", () => {
  it("RepositoryError を返し in-memory state を変更しない", async () => {
    const result = await startExaminationWithEffects(failingDependencies)(VALID_INPUT);
    expect(result._unsafeUnwrapErr().kind).toBe("RepositoryError");
    expect(storedStates).toEqual([]);
    expect(recordedEvents).toEqual([]);
  });
});
```

Run: `pnpm exercise:04`

Expected: 決定性、dual-write、戻り値、保存失敗の assertion が意図通り失敗する。

- [ ] **Step 4: session-05 に非同期の到達点を実装する**

主要な型と、用途を分けた2 APIは次とする。

```ts
type Clock = Readonly<{ now: () => string }>;
type EventIdGenerator = Readonly<{ generate: () => EventId }>;
type EventContext = Readonly<{ eventId: EventId; occurredAt: string }>;
type ExaminationStartedStore = Readonly<{
  store: (event: ExaminationStarted) => ResultAsync<void, RepositoryFailure>;
}>;
type EffectsDependencies = Readonly<{
  resolver: AppointmentResolver;
  store: ExaminationStartedStore;
}> & EventContextDependencies;
type RepositoryFailure = Readonly<{
  kind: "RepositoryFailure";
  operation: "ExaminationStartedStore.store";
  cause: unknown;
}>;
type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: "ExaminationStartedStore.store";
}>;
startExamination: (deps: Dependencies) =>
  (input: StartExaminationInput) => Result<InExamination, StartExaminationError>;
startExaminationWithEffects: (deps: EffectsDependencies) =>
  (input: StartExaminationWithEffectsInput) =>
    ResultAsync<InExamination, StartExaminationWithEffectsError>;
```

`Appointment.startExamination(context)(checkedIn, veterinarianId)` は具体 `ExaminationStarted` を作る純粋な curry 関数にする。`startExaminationWithEffects` は `andThen(...).andThen(...).andThrough(storeExaminationStarted(store)).map(event => event.aggregateState)` の1 pipelineとし、保存は `andThrough` を使う。in-memory adapterだけが `ResultAsync.fromPromise` で例外を `cause` 付きの内部 `RepositoryFailure` へ閉じる。use case境界の `mapErr` は必ず新しい、`cause` を持たないplain objectの `RepositoryError` を作り、生の例外とPIIを公開しない。

S4 exercise を `session-05/test/regression/effects-and-events.test.ts` へ持ち越し、S1〜S4 の全回帰テストを `session-05/test/regression/` で成功させる。`session-05` は `exercises/` と `exercise` script を持たない。

- [ ] **Step 5: root scripts を新契約へ変える**

root script は次の意味にする。

```json
{
  "build": "pnpm --filter @fp-with-ts/docs build",
  "test": "pnpm --filter './examples/session-*' test && pnpm --filter @fp-with-ts/docs test",
  "exercise:01": "pnpm --filter @fp-with-ts/clinic-session-01 exercise",
  "exercise:02": "pnpm --filter @fp-with-ts/clinic-session-02 exercise",
  "exercise:03": "pnpm --filter @fp-with-ts/clinic-session-03 exercise",
  "exercise:04": "pnpm --filter @fp-with-ts/clinic-session-04 exercise",
  "typecheck": "pnpm --filter './examples/session-*' typecheck && pnpm --filter @fp-with-ts/docs typecheck && tsc -p worker/tsconfig.json --noEmit"
}
```

`exercise:00` と `exercise:05` を削除し、root `test` / `typecheck` / `build` から `examples/final` を除外する。

- [ ] **Step 6: P1 で移動した snapshot path を現行 Code Explorer へ最小同期する**

P1 は単独で通常検証を成功させて push する。catalog やページ構造の P2 改稿は先取りせず、現行 Code Explorer の手書き参照だけを実在ファイルへ追従させる。

- S0: `src/{appointment,logger}.ts` → `src/legacy/{appointment,logger}.ts`
- S1: 旧単一ファイル群 → `src/domain/appointment/{appointment,transitions,statusLabel}.ts` と `test/transitions.test.ts`
- S2: `src/domain/appointment.ts` → `src/domain/appointment/appointment.ts`、通常テスト → `test/regression/state-modeling.test.ts`
- S3: kebab-case の boundary / flat な domain / 直下 test → camelCase boundary / `domain/{appointment,ids}` / `test/regression` と `src/useCase/startExamination.ts`
- S4: 旧 `application` / `ports` / `infrastructure` / agent-review → `useCase` / aggregate event / `effects-and-events` exercise。初期表示は `exercises/effects-and-events.test.ts`
- S5: follow-up exercise と旧 gateway / ports → `useCase` / `adaptor/inMemoryExaminationStartedStore.ts` / 全回帰。初期表示は `test/regression/effects-and-events.test.ts`

onboarding guide の path と行 anchor、standalone preview、S4/S5 playground の初期ファイル期待値も同じ移動へ同期する。`project-files.ts` の glob、catalog schema、slug、ページ本文、動的 route、CSS、Worker は変更しない。

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: 旧 snapshot path による ENOENT / visible-files failure がなくなり、docs の通常テストが全成功する。

- [ ] **Step 7: P1 全体を検証する**

Run:

```bash
pnpm typecheck
pnpm test
pnpm --filter @fp-with-ts/clinic-session-05 test
```

さらに `exercise:01`〜`exercise:04` を個別実行し、それぞれが module resolution error ではなく設計された assertion failure で終了することを報告に記録する。

Expected: 通常検証は全成功。4 exercise は開始スナップショットとして意図した RED。`examples/final` の diff は 0 件。

- [ ] **Step 8: P1 を commit する**

```bash
git add examples/session-03 examples/session-04 examples/session-05 package.json pnpm-lock.yaml
git commit -m "feat: Resultと副作用の演習スナップショットを再構築"
git add apps/docs/src/code-explorer apps/docs/src/test/pages/code-explorer.test.ts apps/docs/src/test/pages/sessions/code-playground.test.ts
git commit -m "fix: Code Explorerを新しいsnapshot配置へ同期"
```

Controller gate: Task 2 と Task 3 の task review 承認後に `git push origin main-a5cflu`。

---

### Task 4: P2-A — catalog 契約・差分予算・動的ルートの基盤を作る

**Files:**
- Rewrite: `apps/docs/src/sessions/catalog.ts`
- Rewrite: `apps/docs/src/sessions/catalog.test.ts`
- Create: `apps/docs/src/test/examples/catalog-references.test.ts`
- Create: `apps/docs/src/test/examples/exercise-budget.test.ts`
- Create: `apps/docs/src/components/StepSolution.astro`
- Create: `apps/docs/src/components/PeerReviewPanel.astro`
- Rewrite: `apps/docs/src/layouts/SessionLayout.astro`
- Rewrite: `apps/docs/src/test/layouts/SessionLayout.test.ts`
- Create if the spike passes: `apps/docs/src/pages/sessions/[slug].astro`
- Create if the spike passes: `apps/docs/src/sessions/content/{00-onboarding,01-state-modeling,02-boundary-and-ids,03-result-errors,04-effects-and-events,final}.astro`

**Interfaces:**
- Consumes: P1 の実ファイル、step solutions、実測差分。
- Produces: 全ページ・Code Explorer・運営文書が読む唯一の session metadata と静的 route。

- [ ] **Step 1: catalog の 16 不変条件を失敗するテストとして書く**

`SessionSummary` は `kind`、`timeBreakdown`、exercise のみの `adv` / `peerReview` / `exerciseCommand` / `exerciseModule`、最大 4 `steps`、最大 3 `decisions`、`finalReferences` を持つ。`PeerReview` は `minutes`、`pickCount: 1 | 2`、3 問の `questions` を持つ。

テストは設計 §6.3 の 16 件を固定する。特に合計 150 分、exercise と optional fields の同値、`peerReview.minutes === timeBreakdown.review`、3 問、全参照ファイルと非空の `solutions[].symbol` の実在を literal ではなくデータから検証する。各 `targets[]` は次snapshotの同一相対pathを持つ `solutions[]` に最低1件対応させ、1ステップが複数ファイルの宣言を必要とする場合は、解答参照も複数件を順序付きで持つ。

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/sessions/catalog.test.ts`

Expected: 旧 schema に新フィールドがないため失敗。

- [ ] **Step 2: catalog を最小実装して不変条件を通す**

session は次の 6 件だけにする。

```text
00-onboarding orientation 15
01-state-modeling exercise 30
02-boundary-and-ids exercise 30
03-result-errors exercise 35
04-effects-and-events exercise 35
final reference 5
```

S1〜S4 の `exerciseModule` は順に `src/domain/appointment`、`src/boundary`、`src/useCase`、`src/useCase`。budget は実測値を catalog に書き、上限 5/80 を超えない。実装後の実測値は S1=2ファイル/35行、S2=2/24、S3=3/77、S4=3/72 である。`session-05` は `ExampleSnapshot` union に残すが sessions 配列に入れない。

starterで実際に `AssertionError` となる参加者stepは S1=4件、S2=2件、S3=3件、S4=4件であり、catalog の `steps.length` をこの実測へ一致させる。開始時点からGREENのexercise assertionはparticipant stepとして数えない。

- [ ] **Step 3: 差分予算テストを RED→GREEN で実装する**

starter の module と次 snapshot の同一 module を比較し、コメント・空行を除く追加＋変更行と変更ファイル数を数える。`steps[].targets` が module 配下、step ≤4、decision ≤3 も同じテストで固定する。S1=50、S2=52、S3=55、S4=65 は推定値として比較し、実測値を report と catalog へ記録する。実測が上限を超えた場合は implementation を縮め、上限を無断で緩めない。

- [ ] **Step 4: StepSolution と PeerReviewPanel を RED→GREEN で実装する**

`StepSolution` は非空の `solutions` の各 path と line range から実ソースを切り出し、1ステップの `<details>` 内へ path を明示して宣言順に描画する。S4は最終pipelineをstep 1から先見せせず、実在するtop-level宣言を次の単位で段階表示する。

- step 1: `EventContextDependencies` と `createEventContext`
- step 2: `ExaminationStartedStore` と `EffectsDependencies`
- step 3: `startExaminationWithEffects`
- step 4: `RepositoryFailure`、`RepositoryError`、`StartExaminationWithEffectsError`、`toRepositoryError`、`storeExaminationStarted`

snippetは参加者が手で適用する段階表示である。別の自動契約では、S4全targetの次snapshot同一相対pathをfull fileとして一時複製したsession-04へoverlayし、typecheck、通常回帰、同じexerciseをすべてGREENにする。`PeerReviewPanel` は `N分・1〜2名`、3 問、S1 の約束事へのリンクを静的 HTML として描画する。新しい client island や依存を追加しない。

- [ ] **Step 5: 動的 route の技術 spike を行う**

`[slug].astro` の `getStaticPaths` を catalog から生成し、`import.meta.glob("../../sessions/content/*.astro", { eager: true })` で対応 content を描画する最小テストを先に書く。`pnpm --filter @fp-with-ts/docs build` で 6 HTML が生成され、内部リンク検証が通る場合だけ動的 route を採用する。

Astro 4 の制約で通らない場合は、手書き 6 route を薄い wrapper として残し、catalog schema・共通 layout・構造テストは維持する。失敗理由を report に記録し、他方式や Content Collections を導入しない。

- [ ] **Step 6: SessionLayout を章定義駆動へ変える**

orientation/reference は `incident, legacy, review`、exercise は `incident, legacy, red, refactor, review` の順とし、同じ章定義から desktop/mobile の TOC を生成する。手書き TOC は廃止し、h1 は catalog title と一致させる。

- [ ] **Step 7: P2-A を検証して commit する**

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs build
git add apps/docs/src/sessions apps/docs/src/test/examples apps/docs/src/components apps/docs/src/layouts apps/docs/src/pages/sessions
git commit -m "feat: セッションcatalogと共通ページ基盤を再構築"
```

---

### Task 5: P2-B — セッション本文、Code Explorer、Worker、構造テストを同期する

**Files:**
- Rewrite the route form selected by Task 4: `apps/docs/src/sessions/content/{00-onboarding,01-state-modeling,02-boundary-and-ids,03-result-errors,04-effects-and-events,final}.astro` for a successful dynamic-route spike; otherwise the six matching files under `apps/docs/src/pages/sessions/`
- Rewrite: `apps/docs/src/code-explorer/project-files.ts`
- Rewrite: `apps/docs/src/code-explorer/session-workspaces.ts`
- Rewrite: `apps/docs/src/code-explorer/session-workspaces.test.ts`
- Replace: `apps/docs/src/code-explorer/onboarding-guides.ts` with `apps/docs/src/code-explorer/code-guides/*.ts`
- Rewrite: `apps/docs/src/components/code-explorer/SessionCodeOverview.astro`
- Rewrite: `apps/docs/src/styles/sessions.css`
- Reduce: `apps/docs/src/styles/base.css`
- Delete: `apps/docs/src/pages/code-explorer.astro`
- Delete: `apps/docs/src/styles/code-explorer-preview.css`
- Delete/replace brittle page tests under `apps/docs/src/test/pages/`
- Modify: `apps/docs/public/_headers`
- Modify: `apps/docs/astro.config.ts`
- Modify: `apps/docs/scripts/verify-static-build.mjs`
- Modify: `worker/routes.ts`
- Modify: `worker/routes.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 4 catalog/layout/components と P1 snapshots。
- Produces: 6 公開ページ、4 playground、旧 URL 互換、文言変更に耐える構造テスト。

- [ ] **Step 1: 新しいページ構造テストを先に書く**

`session-structure.test.ts` は kind ごとの章順、TOC 2 組、対応する h2、catalog title の h1 を全 session で検証する。`session-exercise.test.ts` は red/green command、module dir、catalog の `steps` 全件の goal と `steps.length` 件の details、decision invariant/notByType、final references、peer-review 3 問を catalog から検証する。旧 literal 完全一致テストは新テストが RED になった後に削除する。

- [ ] **Step 2: S0〜S4 と Final の本文を実装する**

各ページは設計 §4 の事故、要求、時間内訳、fallback、固有レビュー観点を反映する。exercise page は catalog の `steps`（1〜4件）と `decisions`（1〜3件）を全件描画する。S1 の review 章には約束事 5 点を全文、S2〜S4 は S1 の id へリンクする。Final は「1集約→7集約」「in-memory→SQLite」「単体→全域検証」の 3 差分と最初に読む final file を示す。

- [ ] **Step 3: Code Explorer を catalog と P1 snapshots へ同期する**

`project-files.ts` は `session-05` を含む snapshot 一覧から glob を導出する。workspace は新 slug に対応し、`initialFile ∈ visibleFiles`、`visibleFiles ⊆ projectFiles`、`steps.targets ⊆ visibleFiles`、解答 snapshot のファイルを編集 workspace に混ぜない、の 4 条件を検証する。`SessionCodeOverview` は slug/guides を Props にする。

- [ ] **Step 4: 孤立ページ・死に CSS・旧 route を整理する**

`/code-explorer/` と専用 CSS/header を削除し、未使用の `.module-*` と `.requirement-dialogue*` だけを削除する。トップページ用 CSS は変更しない。Worker に 04/05 旧 URL の 308 redirect を追加し、既存 redirect を維持する。

- [ ] **Step 5: build verifier と e2e 契約を catalog 駆動へ変える**

`verify-static-build.mjs` の必須 HTML は catalog から導出し、余分な HTML 禁止を維持する。playground/semantic e2e は catalog から parameterize し、home visual test と screenshot は変更しない。

- [ ] **Step 6: P2 全体を検証する**

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs build
pnpm --filter @fp-with-ts/docs exec vitest run ../../worker/routes.test.ts
pnpm typecheck
pnpm test
pnpm build
```

CSS/レスポンシブ変更は `pnpm --filter @fp-with-ts/docs test:visual` を実行し、home screenshot に差分がないことを確認する。利用可能なら dev server を `0.0.0.0` で起動し、S0/S1/S4/Final を mobile と desktop で目視する。実画面確認できない場合は未実施理由を report に書く。

- [ ] **Step 7: P2 を commit する**

```bash
git add apps/docs worker README.md
git commit -m "feat: 教材サイトを新カリキュラムへ再構築"
```

Controller gate: Task 4 と Task 5 の task review 承認後に `git push origin main-a5cflu`。

---

### Task 6: P3 — 運営文書と印刷用レビュー成果物を作る

**Files:**
- Rewrite: `docs/event/facilitator-guide.md`
- Rewrite: `docs/event/participant-setup.md`
- Modify: `docs/event/troubleshooting.md`
- Create: `docs/event/review-sheet.md`
- Create: `docs/event/peer-review-card.md`

**Interfaces:**
- Consumes: catalog の時刻、ADV、peerReview 3 問、P1/P2 の実コマンドと fallback。
- Produces: 参加者事前案内、TA 進行、A4 レビュー観点シート、A5 両面進行カード。

- [ ] **Step 1: 文書間の数値を catalog と照合する検証を用意する**

既存 docs test または小さな純ロジック test で、6 session の分数、exercise 01〜04、review 7/7/8/8、3 問が catalog と運営文書で矛盾しないことを検証する。人向け prose の全文一致は行わず、共有すべき構造値だけを検証する。

- [ ] **Step 2: facilitator guide を 180 分の新進行へ更新する**

0:25/0:55/1:25/2:10 の checkpoint、S2 は catalog の `steps` の末尾から講師デモへ降格すること、S4 の step 3 demo 化、相互レビューは落とさず 2 人目枠を落とす順序を明記する。TA の巡回は詰まり発見と review 対象選定の両方を目的とする。

- [ ] **Step 3: peer-review card を作る**

A5 両面相当の Markdown に、優先順つき選定基準 5 件、7/8 分版の 30 秒単位進行、catalog と同じ 3 問、約束事 5 点、4 回×最大 2 名の記録欄、非保持者・保持者 0 名・display なし・時間超過の例外 4 件を含める。display は未確認と明記し、fallback は 1 file/20 lines とする。

- [ ] **Step 4: review sheet を作る**

A4 片面相当で S1〜S4 の「不変条件」「依頼文の1文」「型で守れなかった残り」と、最後の「明日の業務で最初に見る箇所」を書けるようにする。各回の review 末尾 1 分で書き、自分の差分が選ばれなくても書くことを紙面に印刷する。

- [ ] **Step 5: participant setup と troubleshooting を更新する**

Node 20+、Chrome/Edge 現行、事前 `pnpm install`、local clone 主線、agent 任意・新規 API key 不要、4 回の peer review 事前告知を含める。troubleshooting は assertion-based RED、module 外差分の戻し方、display/ミラーリング/一時的な font 拡大を扱うが、会場設備確認済みとは書かない。

- [ ] **Step 6: P3 を検証して commit する**

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs build
pnpm test
git add docs/event
git commit -m "docs: 新カリキュラムの運営資料を整備"
```

Controller gate: task review 承認後に `git push origin main-a5cflu`。

---

### Task 7: P4 — 自動リハーサル証跡とリリース検証を残す

**Files:**
- Create: `docs/event/rehearsal-2026-08-15.md`
- Modify only if evidence requires calibration: `apps/docs/src/sessions/catalog.ts`
- Modify only if evidence requires operational fallback: `docs/event/facilitator-guide.md`, `docs/event/peer-review-card.md`

**Interfaces:**
- Consumes: P1〜P3 の完成ツリー。
- Produces: 自動化できる検証の実測値、意図した RED の記録、手動リハーサルの未確認項目を分離したリリース判断材料。

- [ ] **Step 1: 全体の fresh verification を実行する**

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @fp-with-ts/docs test:visual
```

Expected: 全コマンド exit 0、home screenshot 差分 0。test 件数と所要時間を rehearsal 文書へ記録する。

- [ ] **Step 2: 4 exercise の RED 品質を確認する**

```bash
pnpm exercise:01
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
```

Expected: 各コマンドは開始 snapshot として non-zero。各 session で catalog の `steps.length` 件（S1=4、S2=2、S3=3、S4=4）に対応する業務名の assertion が `AssertionError` として失敗し、module resolution/type setup error や予期しない例外はない。exercise に含まれる全testの fail/pass 数を分けて記録する。

- [ ] **Step 3: 次 snapshot の GREEN 連鎖を確認する**

```bash
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-05 test
```

Expected: 直前 exercise の回帰がすべて成功し、session-05 は S1〜S4 全回帰を含む。

- [ ] **Step 4: 予算と final 凍結を確認する**

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/test/examples/exercise-budget.test.ts
git diff --exit-code b8492ba3895adecf5cb1593a79008c90908f4090 -- examples/final
```

Expected: S1〜S4 が 5 files/80 effective lines 以下、final diff 0。

- [ ] **Step 5: 自動化できない P4 条件を明示する**

rehearsal 文書に次を `未確認（現地/人間のリハーサルが必要）` として残す。

```text
- エージェントなし参加者が delegate 8〜10分で catalog の `steps`（1〜4件）を完了できるか
- 5人班で peer review 7分版が回るか、問い1で沈黙しないか
- S2 teach 7分で参加者が delegate を開始できるか
- 班数分の外部 display、HDMI、USB-C adapter、電源があるか
- review 対象になる心理的負担と、拒否する参加者の扱い
```

これらを成功済みと書かない。自動検証結果から budget や fallback を変える必要がある場合だけ、根拠とともに同じ commit で調整する。

- [ ] **Step 6: P4 を commit する**

```bash
git add docs/event/rehearsal-2026-08-15.md apps/docs/src/sessions/catalog.ts docs/event/facilitator-guide.md docs/event/peer-review-card.md
git commit -m "test: 新カリキュラムのリハーサル結果を記録"
```

Controller gate: task review、whole-branch final review、fresh `pnpm typecheck && pnpm test && pnpm build` 後に `git push origin main-a5cflu`。

---

## Final Pull Request Update

全 task 完了後、controller は次を行う。

1. merge base から HEAD の whole-branch review を最も高い判断力の reviewer subagent に依頼する。
2. Critical/Important finding は 1 回の fix wave と scoped re-review で解消する。
3. PR #36 の title を実装を含む表現へ更新し、body を `背景 / 内容 / 検証 / 手動確認が残る事項` に更新する。
4. PR head が `main-a5cflu`、base が `main`、最新 head SHA が remote と一致することを `gh pr view 36` で確認する。
5. worktree は PR feedback 用に保持する。
