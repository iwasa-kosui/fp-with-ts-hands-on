# Workers 未実装ページとルーター統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workers で配信するハンズオンサイトを通常パスのデータ駆動 SPA に統一し、既存 Module 00 と未実装6モジュールの全コンテンツを PRD に沿って公開します。

**Architecture:** 単一の Vite エントリを Workers Static Assets の SPA fallback で配信します。ルート解析、コンテンツ、DOM レンダリング、ブラウザ連携を分離し、7モジュールのデータを `modules.ts` から一元的に参照します。各モジュールの本文は個別ファイルへ分け、`modules.ts` は順序と検索を担う唯一のレジストリにします。

**Tech Stack:** TypeScript 5.6 以上、Vite 5.4、Vitest 2.1、happy-dom、pnpm 9.12、Cloudflare Workers Static Assets

## Global Constraints

- 要件の基準は `docs/prd/prd-001.md` です。
- 設計の基準は `docs/superpowers/specs/2026-08-05-workers-unimplemented-pages-design.md` です。
- PRD-01〜PRD-10 と PRD-12 を実装し、テストと対応付けます。
- PRD-11 の30日後フォローアップは、2026年8月5日にユーザーが承認したスコープ例外です。
- 各モジュールの起点は事故に固定せず、`incident`、`new-requirement`、`review` のいずれかにします。`review` は PRD 上の要求として扱います。
- 参加者が編集する対象はモジュールごとに最大2関数です。読むだけの型や関数と明確に分けます。
- 通常テストは初期状態から成功させ、`exercise:*` の演習テストと分離します。Exercise 00 は事故を観察するため赤いままにします。
- 正規 URL は `/modules/<slug>/` とし、ハッシュ URL は生成しません。
- 旧 `/module-00/` は `/modules/00-break-the-app/` へ置き換えます。
- Worker、`wrangler.jsonc`、clinic-example の実装と演習テストは変更しません。
- 外部 API、データベース、Docker、外部アカウントは追加しません。
- baseline は2026年8月5日時点で `pnpm typecheck`、11件の通常テスト、`pnpm build` が成功しています。

---

## File Structure

### コンテンツ

- `apps/docs/src/content/module-content.ts` — PRD に対応する型とコンテンツ検査関数
- `apps/docs/src/content/modules/00-break-the-app.ts` — 導入事故の観察ページ
- `apps/docs/src/content/modules/00-read-the-incident.ts` — 追加要求を状態別の情報へ分解するページ
- `apps/docs/src/content/modules/01-state-modeling.ts` — 状態遷移を型にするページ
- `apps/docs/src/content/modules/02-boundary-and-ids.ts` — 境界、ID、PII を扱うページ
- `apps/docs/src/content/modules/03-result-errors.ts` — Result と変更記録を扱うページ
- `apps/docs/src/content/modules/04-agent-review.ts` — エージェントレビューを設計するページ
- `apps/docs/src/content/modules/05-mini-integration.ts` — 最終演習と行動計画のページ
- `apps/docs/src/content/modules.ts` — 7モジュールの順序、`moduleBySlug`、前後関係の一元管理
- `apps/docs/src/content/home.ts` — PRD-01 を満たすトップページの文章と一覧情報

### ルーティングと画面

- `apps/docs/src/routes.ts` — pathname の正規化、ルート解析、URL 生成
- `apps/docs/src/components/content-block.ts` — 型付き本文ブロックの DOM 生成
- `apps/docs/src/components/code-block.ts` — コードとコマンドの DOM 生成
- `apps/docs/src/components/module-card.ts` — トップのモジュールカード
- `apps/docs/src/pages/home-page.ts` — トップページの DOM 生成
- `apps/docs/src/pages/module-page.ts` — 詳細ページと前後ナビゲーションの DOM 生成
- `apps/docs/src/pages/not-found-page.ts` — アプリ内 404 の DOM 生成
- `apps/docs/src/app.ts` — ルート解決、描画、History API、フォーカス管理
- `apps/docs/src/main.ts` — `#app` の取得とアプリ起動だけを担当
- `apps/docs/src/styles/base.css` — Module 00 を基準にした全ページ共通 CSS

### テストと設定

- `apps/docs/vitest.config.ts` — happy-dom を使う docs テスト設定
- `apps/docs/src/content/module-content.test.ts` — PRD コンテンツ契約
- `apps/docs/src/content/modules.test.ts` — 7モジュールの完全性と順序
- `apps/docs/src/routes.test.ts` — 正規 URL、互換 URL、404
- `apps/docs/src/components/content-block.test.ts` — 全ブロック種別のレンダリング
- `apps/docs/src/pages/home-page.test.ts` — PRD-01 と7件の導線
- `apps/docs/src/pages/module-page.test.ts` — 詳細セクションと前後ナビゲーション
- `apps/docs/src/app.test.ts` — クリック、戻る・進む、正規 URL への置換
- `apps/docs/src/prd-coverage.test.ts` — PRD-01〜10、12の最終対応検査

---

### Task 1: docs のテスト基盤と実行可能な PRD コンテンツ契約

**Files:**
- Modify: `apps/docs/package.json:6`
- Modify: `apps/docs/tsconfig.json:2`
- Modify: `package.json:10`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/prd/prd-001.md` の PRD-02
- Create: `apps/docs/vitest.config.ts`
- Create: `apps/docs/src/content/module-content.ts`
- Test: `apps/docs/src/content/module-content.test.ts`

**Interfaces:**
- Produces: `ModuleTrigger`, `ContentBlock`, `ModuleContent`, `assertModuleMeetsPrd(module: ModuleContent): void`
- Produces: docs の `test` script と root の docs を含む `test` script

- [ ] **Step 1: docs にテスト依存と設定を追加する**

Run:

```bash
pnpm --filter @fp-with-ts/docs add -D vitest@^2.1.0 happy-dom@^15.11.7
```

`apps/docs/package.json` に次を追加します。

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

`apps/docs/vitest.config.ts` を作成します。

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
```

`apps/docs/tsconfig.json` の `include` に `vitest.config.ts` を追加します。root の `test` は次の順にします。

```json
{
  "test": "pnpm --filter @fp-with-ts/docs test && pnpm --filter @fp-with-ts/clinic-example test"
}
```

- [ ] **Step 2: PRD 契約の失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import {
  assertModuleMeetsPrd,
  type ModuleContent,
} from "./module-content";

const validModule: ModuleContent = {
  id: "01-state-modeling",
  slug: "01-state-modeling",
  label: "Module 01",
  title: "状態遷移を型にする",
  durationMinutes: 35,
  caseStudy: {
    animalName: "Mugi",
    animalType: "犬",
    avatar: "🐕",
    context: "動物病院の予約と診察",
  },
  trigger: {
    kind: "new-requirement",
    situation: "予約状態へキャンセル情報を追加します。",
    requirement: "キャンセル理由と再診希望を誤った状態に付けられないようにします。",
  },
  invariant: "Paid と Canceled は終端状態です。",
  mission: "状態と必須データを判別共用体へ閉じます。",
  technique: {
    name: "Discriminated Union",
    reason: "状態と必須データを同じ variant に閉じます。",
    limits: "外部の unknown 入力と PII の実行時漏えいは別の境界で守ります。",
  },
  editTargets: [
    { file: "src/clinic/appointment.ts", symbol: "Appointment.startExamination" },
    { file: "src/clinic/appointment.ts", symbol: "Appointment.cancelWithReason" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "不正な状態遷移または不足した状態データを検出します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "状態遷移と型テストが成功します。",
  },
  filesToRead: [
    { file: "src/clinic/appointment.ts", focus: "Appointment union と終端状態" },
  ],
  reviewPoints: ["kind の網羅性を確認します。"],
  doneWhen: ["不正な状態をどこで拒否するか説明できます。"],
  changeImpact: "次の状態追加で確認する分岐が kind に集約されます。",
  reflectionQuestions: ["不正な状態は生成時と遷移時のどちらで拒否しますか。"],
  fallbackGuidance: "提示済み union を使い、2関数だけを kind で分岐させます。",
  workedExamples: [
    {
      file: "src/clinic/appointment.ts",
      symbols: ["Appointment.startExamination", "Appointment.cancelWithReason"],
    },
  ],
  resources: [],
  blocks: [
    { kind: "prose", heading: "要求を読む", paragraphs: ["終端状態を先に確認します。"] },
  ],
};

describe("assertModuleMeetsPrd", () => {
  it("PRD 必須項目が揃ったモジュールを受理する", () => {
    expect(() => assertModuleMeetsPrd(validModule)).not.toThrow();
  });

  it("編集対象が3関数なら拒否する", () => {
    const invalid = {
      ...validModule,
      editTargets: [
        ...validModule.editTargets,
        { file: "src/clinic/appointment.ts", symbol: "Appointment.checkIn" },
      ],
    };
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-06");
  });

  it("技法の限界が空なら拒否する", () => {
    const invalid = {
      ...validModule,
      technique: { ...validModule.technique, limits: "" },
    };
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-05");
  });
});
```

- [ ] **Step 3: テストを実行して未実装の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/module-content.test.ts`

Expected: FAIL with `Cannot find module './module-content'`.

- [ ] **Step 4: コンテンツ型と検査関数を実装する**

`ContentBlock` は次の判別共用体にします。

```ts
export type ModuleTrigger =
  | Readonly<{ kind: "incident"; situation: string; incident: string }>
  | Readonly<{ kind: "new-requirement"; situation: string; requirement: string }>
  | Readonly<{ kind: "review"; situation: string; reviewProblem: string }>;

export type ContentBlock =
  | Readonly<{ kind: "prose"; heading: string; paragraphs: readonly string[] }>
  | Readonly<{ kind: "code"; heading: string; language: string; code: string }>
  | Readonly<{ kind: "command"; phase: "red" | "green"; command: string; expected: string }>
  | Readonly<{
      kind: "file-table";
      heading: string;
      rows: readonly Readonly<{ file: string; focus: string; mode: "read" | "edit" }>[];
    }>
  | Readonly<{ kind: "checklist"; heading: string; items: readonly string[] }>;

export type ModuleContent = Readonly<{
  id: string;
  slug: string;
  label: string;
  title: string;
  durationMinutes: number;
  caseStudy: Readonly<{
    animalName: string;
    animalType: string;
    avatar: string;
    context: string;
  }>;
  trigger: ModuleTrigger;
  invariant: string;
  mission: string;
  technique: Readonly<{ name: string; reason: string; limits: string }>;
  editTargets: readonly Readonly<{ file: string; symbol: string }>[];
  red: Readonly<{ command: string; expected: string }>;
  green: Readonly<{ command: string; expected: string }>;
  filesToRead: readonly Readonly<{ file: string; focus: string }>[];
  reviewPoints: readonly string[];
  doneWhen: readonly string[];
  changeImpact: string;
  reflectionQuestions: readonly string[];
  fallbackGuidance: string;
  workedExamples: readonly Readonly<{ file: string; symbols: readonly string[] }>[];
  resources: readonly Readonly<{ label: string; href: string }>[];
  blocks: readonly ContentBlock[];
  finalActionPlan?: Readonly<{
    implementationPrompt: string;
    firstActionPrompt: string;
  }>;
}>;

const isBlank = (value: string): boolean => value.trim().length === 0;

export const assertModuleMeetsPrd = (module: ModuleContent): void => {
  const triggerDetail =
    module.trigger.kind === "incident"
      ? module.trigger.incident
      : module.trigger.kind === "new-requirement"
        ? module.trigger.requirement
        : module.trigger.reviewProblem;
  if (isBlank(module.trigger.situation) || isBlank(triggerDetail) || isBlank(module.invariant)) {
    throw new Error(`PRD-02: ${module.id}`);
  }
  if (module.editTargets.length > 2) throw new Error(`PRD-06: ${module.id}`);
  if (isBlank(module.technique.reason)) throw new Error(`PRD-04: ${module.id}`);
  if (isBlank(module.technique.limits)) throw new Error(`PRD-05: ${module.id}`);
  if (isBlank(module.red.command) || isBlank(module.red.expected)) throw new Error(`PRD-03: ${module.id}`);
  if (isBlank(module.green.command) || isBlank(module.green.expected) || isBlank(module.changeImpact)) {
    throw new Error(`PRD-07: ${module.id}`);
  }
  if (module.reflectionQuestions.length === 0) throw new Error(`PRD-08: ${module.id}`);
  if (isBlank(module.fallbackGuidance) || module.workedExamples.length === 0) {
    throw new Error(`PRD-12: ${module.id}`);
  }
};
```

- [ ] **Step 5: テストと型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/module-content.test.ts`

Expected: 3 tests PASS.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS.

- [ ] **Step 6: PRD-02 の表現を承認済みの要件へ合わせる**

PRD-02 を次の意味が一意になる文章へ変更します。

```markdown
- すべてのモジュールで、主な起点となる新しい要求または事故と、守るべき不変条件を明示します。
```

PRD-11 自体は変更せず、本計画と設計書だけでスコープ例外を記録します。

- [ ] **Step 7: コミットする**

```bash
git add apps/docs/package.json apps/docs/tsconfig.json apps/docs/vitest.config.ts apps/docs/src/content/module-content.ts apps/docs/src/content/module-content.test.ts package.json pnpm-lock.yaml docs/prd/prd-001.md
git commit -m "test(docs): PRDコンテンツ契約を実行可能にする"
```

---

### Task 2: 導入事故と要求整理の2モジュールを型付きデータへ移す

**Files:**
- Create: `apps/docs/src/content/modules/00-break-the-app.ts`
- Create: `apps/docs/src/content/modules/00-read-the-incident.ts`
- Test: `apps/docs/src/content/modules/00-introduction.test.ts`
- Source: `apps/docs/src/content/modules.ts:37-89`
- Source: `apps/docs/public/module-00/index.html:397`

**Interfaces:**
- Consumes: `ModuleContent`, `assertModuleMeetsPrd`
- Produces: `breakTheAppModule: ModuleContent`, `readTheIncidentModule: ModuleContent`

- [ ] **Step 1: 2モジュールの起点と PRD 契約をテストする**

```ts
import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import { breakTheAppModule } from "./00-break-the-app";
import { readTheIncidentModule } from "./00-read-the-incident";

describe("introduction modules", () => {
  it("事故を再現する導入は incident から始まる", () => {
    expect(breakTheAppModule.trigger.kind).toBe("incident");
    expect(breakTheAppModule.editTargets).toHaveLength(0);
    expect(breakTheAppModule.red.command).toContain("exercise:00");
    expect(() => assertModuleMeetsPrd(breakTheAppModule)).not.toThrow();
  });

  it("要求整理は new-requirement から始まる", () => {
    expect(readTheIncidentModule.trigger.kind).toBe("new-requirement");
    expect(readTheIncidentModule.editTargets).toHaveLength(0);
    expect(readTheIncidentModule.red.command).toContain("exercise:01");
    expect(() => assertModuleMeetsPrd(readTheIncidentModule)).not.toThrow();
  });
});
```

- [ ] **Step 2: テストを実行してデータ未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/00-introduction.test.ts`

Expected: FAIL with missing `00-break-the-app` and `00-read-the-incident` modules.

- [ ] **Step 3: `00-break-the-app` を移行する**

既存の動物、時間、本文、Module 00 の静的ページにあるコマンド、ファイル表、観察事項を移します。動物と題材は `caseStudy` に移します。PRD 追加項目は次の内容に固定します。

```ts
trigger: {
  kind: "incident",
  situation: "再診察を開始する要求へ既存コードで対応します。",
  incident: "会計済みの予約が診察中へ戻り、会計後の状態が壊れました。",
},
invariant: "Paid は終端状態で、診察中へ遷移しません。",
mission: "通常テストが緑でも残る不正な遷移を事故テストで観察します。",
technique: {
  name: "事故テストによる観察",
  reason: "型に表現されていない業務ルールを観察可能な失敗にします。",
  limits: "このモジュールでは原因を観察するだけで、状態モデルは修正しません。",
},
editTargets: [],
red: {
  command: "pnpm --filter @fp-with-ts/clinic-example exercise:00",
  expected: "Paid から InExamination へ戻れる事故が再現され、テストが失敗します。",
},
green: {
  command: "pnpm --filter @fp-with-ts/clinic-example test",
  expected: "通常フローの11テストは成功したままです。",
},
reflectionQuestions: [
  "Paid が終端であるというルールは、現在の型と updateStatus のどこで失われていますか。",
],
fallbackGuidance: "通常テストを先に実行し、次に事故テストと legacy/appointment.ts の updateStatus を読み合わせます。",
workedExamples: [
  { file: "src/legacy/appointment.ts", symbols: ["bookAppointment", "updateStatus"] },
],
```

読む対象は `LegacyAppointment.status`、optional fields、`bookAppointment`、`updateStatus` です。参加者へ編集は指示しません。

- [ ] **Step 4: `00-read-the-incident` を移行する**

```ts
trigger: {
  kind: "new-requirement",
  situation: "キャンセル後の業務対応に必要な情報を整理します。",
  requirement: "キャンセル理由と再診希望日を残せるようにします。",
},
invariant: "Canceled は reason を持ち、再診希望はキャンセル時だけに存在します。",
mission: "追加要求を、状態ごとに必要な情報へ分解します。",
technique: {
  name: "状態別の要求整理",
  reason: "全予約への optional field 追加を避け、情報が属する状態を先に決めます。",
  limits: "このモジュールでは遷移関数を変更せず、次の状態モデリングに必要な整理までを行います。",
},
editTargets: [],
red: {
  command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
  expected: "キャンセル状態の必須情報と終端状態の制約がテストから読み取れます。",
},
green: {
  command: "pnpm --filter @fp-with-ts/clinic-example test",
  expected: "要求整理では実装を変更しないため、通常テストは成功したままです。",
},
reflectionQuestions: [
  "キャンセル理由と再診希望日を optional field にすると、どの不正な予約を表現できてしまいますか。",
],
fallbackGuidance: "Scheduled と Canceled の必須情報を書き出し、Canceled 以外から reason と再診希望を外します。",
workedExamples: [
  { file: "src/clinic/appointment.ts", symbols: ["Appointment", "Appointment.cancelWithReason"] },
],
```

- [ ] **Step 5: 2モジュールのテストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/00-introduction.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 6: コミットする**

```bash
git add apps/docs/src/content/modules/00-break-the-app.ts apps/docs/src/content/modules/00-read-the-incident.ts apps/docs/src/content/modules/00-introduction.test.ts
git commit -m "feat(docs): 導入事故と要求整理のコンテンツを定義"
```

---

### Task 3: 状態モデリングと境界保護のコンテンツを定義する

**Files:**
- Create: `apps/docs/src/content/modules/01-state-modeling.ts`
- Create: `apps/docs/src/content/modules/02-boundary-and-ids.ts`
- Test: `apps/docs/src/content/modules/01-02.test.ts`
- Source: `apps/docs/src/content/modules.ts:90-148`
- Source: `packages/clinic-example/exercises/01-state-modeling.test.ts:1`
- Source: `packages/clinic-example/exercises/02-boundary-and-ids.test.ts:1`

**Interfaces:**
- Consumes: `ModuleContent`, `assertModuleMeetsPrd`
- Produces: `stateModelingModule: ModuleContent`, `boundaryAndIdsModule: ModuleContent`

- [ ] **Step 1: 起点と編集対象の失敗テストを書く**

```ts
expect(stateModelingModule.trigger.kind).toBe("new-requirement");
expect(stateModelingModule.editTargets.map(({ symbol }) => symbol)).toEqual([
  "Appointment.startExamination",
  "Appointment.cancelWithReason",
]);
expect(boundaryAndIdsModule.trigger.kind).toBe("incident");
expect(boundaryAndIdsModule.editTargets.map(({ symbol }) => symbol)).toEqual([
  "ExamResult.safeParse",
  "OwnerContact.safeParse",
]);
expect(() => assertModuleMeetsPrd(stateModelingModule)).not.toThrow();
expect(() => assertModuleMeetsPrd(boundaryAndIdsModule)).not.toThrow();
```

- [ ] **Step 2: テストを実行してデータ未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/01-02.test.ts`

Expected: FAIL with missing module files.

- [ ] **Step 3: `01-state-modeling` を定義する**

起点は「キャンセル理由と再診希望を誤った状態へ付けられないようにする」という新要求です。技法は Discriminated Union、限界は外部の `unknown` 入力と PII の実行時保護です。Red と Green は `exercise:01` を使います。

編集対象は次の2関数だけです。

```ts
editTargets: [
  { file: "src/clinic/appointment.ts", symbol: "Appointment.startExamination" },
  { file: "src/clinic/appointment.ts", symbol: "Appointment.cancelWithReason" },
],
reflectionQuestions: [
  "不正な状態は生成時に防ぐべきですか、それとも遷移関数の Result で拒否すべきですか。",
],
fallbackGuidance: "提示済みの Appointment union を使い、2関数だけを kind で分岐させます。@ts-expect-error が意図した箇所にあるか確認します。",
workedExamples: [
  { file: "src/clinic/appointment.ts", symbols: ["Appointment.startExamination", "Appointment.cancelWithReason"] },
],
```

`Appointment` union、`book`、`checkIn`、`recordPayment`、`isTerminal` は読むだけと明記します。

- [ ] **Step 4: `02-boundary-and-ids` を定義する**

起点は「petId と ownerId の取り違えと PII のログ出力」という事故です。技法は Zod、Branded Type、Sensitive の組み合わせです。限界として、Branded Type だけではログ漏えいを防げず、Sensitive だけでは入力妥当性を保証できないことを記載します。

編集対象は次の2関数へ制限します。

```ts
editTargets: [
  { file: "src/clinic/exam-result.ts", symbol: "ExamResult.safeParse" },
  { file: "src/clinic/owner-contact.ts", symbol: "OwnerContact.safeParse" },
],
reflectionQuestions: [
  "Zod、Branded Type、Sensitive は、それぞれどの境界と事故を担当していますか。",
],
fallbackGuidance: "payload を unknown に戻し、parse、ID 変換、Sensitive 変換の順に確認します。最後に JSON.stringify の結果が [REDACTED] か確認します。",
workedExamples: [
  { file: "src/clinic/exam-result.ts", symbols: ["ExamResult.safeParse"] },
  { file: "src/clinic/owner-contact.ts", symbols: ["OwnerContact.safeParse"] },
],
```

`PetId.safeParse`、`PetId.schema`、`Sensitive.of`、`toJSON`、`toString` は worked example として読む対象にします。Red と Green は `exercise:02` です。

- [ ] **Step 5: テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/01-02.test.ts`

Expected: PASS and each module has at most 2 edit targets.

- [ ] **Step 6: コミットする**

```bash
git add apps/docs/src/content/modules/01-state-modeling.ts apps/docs/src/content/modules/02-boundary-and-ids.ts apps/docs/src/content/modules/01-02.test.ts
git commit -m "feat(docs): 状態モデリングと境界保護の教材を定義"
```

---

### Task 4: Result とエージェントレビューのコンテンツを定義する

**Files:**
- Create: `apps/docs/src/content/modules/03-result-errors.ts`
- Create: `apps/docs/src/content/modules/04-agent-review.ts`
- Test: `apps/docs/src/content/modules/03-04.test.ts`
- Source: `apps/docs/src/content/modules.ts:149-204`
- Source: `packages/clinic-example/exercises/03-result-errors.test.ts:1`
- Source: `packages/clinic-example/exercises/04-agent-review.test.ts:1`

**Interfaces:**
- Consumes: `ModuleContent`, `assertModuleMeetsPrd`
- Produces: `resultErrorsModule: ModuleContent`, `agentReviewModule: ModuleContent`

- [ ] **Step 1: 起点、編集対象、限界説明の失敗テストを書く**

```ts
expect(resultErrorsModule.trigger.kind).toBe("new-requirement");
expect(resultErrorsModule.editTargets.map(({ symbol }) => symbol)).toEqual([
  "startExaminationUseCase",
]);
expect(resultErrorsModule.technique.limits).toContain("event sourcing");
expect(agentReviewModule.trigger.kind).toBe("review");
expect(agentReviewModule.editTargets.map(({ symbol }) => symbol)).toEqual([
  "agentReviewChecklist",
  "buildFollowUpAgentPrompt",
]);
expect(() => assertModuleMeetsPrd(resultErrorsModule)).not.toThrow();
expect(() => assertModuleMeetsPrd(agentReviewModule)).not.toThrow();
```

- [ ] **Step 2: テストを実行してデータ未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/03-04.test.ts`

Expected: FAIL with missing module files.

- [ ] **Step 3: `03-result-errors` を定義する**

新要求は「診察開始の失敗理由を UI に表示し、成功した開始だけを追跡する」です。不変条件は、失敗を Result の `kind` で返し、`ExaminationStarted` を成功時だけ記録することです。

```ts
technique: {
  name: "Result と最小の Domain Event",
  reason: "呼び出し元が失敗理由を網羅的に分岐し、成功した変更だけを追跡できるようにします。",
  limits: "event sourcing、projection、永続イベントストアには広げません。",
},
editTargets: [
  { file: "src/clinic/use-cases.ts", symbol: "startExaminationUseCase" },
],
reflectionQuestions: [
  "UI に返す失敗値と、事故調査のために残す成功イベントは、なぜ別の値ですか。",
],
fallbackGuidance: "error.kind ごとの戻り値を確認し、失敗ケースでは event store が空、成功ケースだけ ExaminationStarted があることをテストします。",
workedExamples: [
  { file: "src/clinic/use-cases.ts", symbols: ["startExaminationUseCase"] },
],
```

`StartExaminationError`、schema、guard、repository、event store は読む対象です。Red と Green は `exercise:03` です。

- [ ] **Step 4: `04-agent-review` を定義する**

起点は「電話フォロー対象の抽出を AI エージェントへ依頼する」というレビュー要求です。型とテストに任せる確認と、人が要求から確認する範囲を分けます。

```ts
trigger: {
  kind: "review",
  situation: "既存の設計判断を保ったまま、AI エージェントへ追加機能を依頼します。",
  reviewProblem: "実装だけを頼むと、終端状態、境界、PII、失敗型の前提が抜けます。",
},
technique: {
  name: "検証可能な依頼とレビュー観点",
  reason: "既存の設計判断を checklist と具体的な prompt に変換します。",
  limits: "型が通ることだけで要求適合性まで保証できるとは扱いません。",
},
editTargets: [
  { file: "src/clinic/agent-review.ts", symbol: "agentReviewChecklist" },
  { file: "src/clinic/agent-review.ts", symbol: "buildFollowUpAgentPrompt" },
],
reflectionQuestions: [
  "型とテストに任せられる確認と、人が要求からレビューすべき確認はどこで分かれますか。",
],
fallbackGuidance: "状態遷移、境界、Sensitive、Result、domain event の5項目を順に prompt へ入れ、検証可能な文になっているか確認します。",
workedExamples: [
  { file: "src/clinic/agent-review.ts", symbols: ["agentReviewChecklist", "buildFollowUpAgentPrompt"] },
],
```

- [ ] **Step 5: テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules/03-04.test.ts`

Expected: PASS.

- [ ] **Step 6: コミットする**

```bash
git add apps/docs/src/content/modules/03-result-errors.ts apps/docs/src/content/modules/04-agent-review.ts apps/docs/src/content/modules/03-04.test.ts
git commit -m "feat(docs): Resultとエージェントレビューの教材を定義"
```

---

### Task 5: 最終演習を定義して7モジュールのレジストリを切り替える

**Files:**
- Create: `apps/docs/src/content/modules/05-mini-integration.ts`
- Modify: `apps/docs/src/content/modules.ts:1-236`
- Modify: `apps/docs/src/main.ts:1-224`
- Modify: `apps/docs/src/components/module-card.ts:1`
- Test: `apps/docs/src/content/modules.test.ts`
- Source: `packages/clinic-example/exercises/05-follow-up.test.ts:1`
- Source: `docs/event/facilitator-guide.md:63`

**Interfaces:**
- Consumes: 7つの `ModuleContent`
- Produces: `modules: readonly ModuleContent[]`
- Produces: `moduleBySlug(slug: string): ModuleContent | undefined`
- Produces: `moduleNeighbors(slug: string): { previous?: ModuleContent; next?: ModuleContent }`
- Produces: `renderModuleCard(module: ModuleContent): HTMLElement` の型移行済み最小実装

- [ ] **Step 1: 7件の順序、PRD-09、PRD-10、PRD-12の失敗テストを書く**

```ts
expect(modules.map(({ slug }) => slug)).toEqual([
  "00-break-the-app",
  "00-read-the-incident",
  "01-state-modeling",
  "02-boundary-and-ids",
  "03-result-errors",
  "04-agent-review",
  "05-mini-integration",
]);

for (const module of modules) {
  expect(() => assertModuleMeetsPrd(module)).not.toThrow();
}

const finalModule = moduleBySlug("05-mini-integration");
expect(finalModule?.finalActionPlan).toEqual({
  implementationPrompt: "自分の業務コードで最初に見直す実装箇所を書いてください。",
  firstActionPrompt: "その箇所で最初に試す行動を書いてください。",
});

expect(moduleNeighbors("02-boundary-and-ids")).toMatchObject({
  previous: { slug: "01-state-modeling" },
  next: { slug: "03-result-errors" },
});
```

- [ ] **Step 2: テストを実行して旧レジストリとの不一致を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules.test.ts`

Expected: FAIL because the registry still uses the legacy `ModuleContent` shape and the final action plan is missing.

- [ ] **Step 3: `05-mini-integration` を定義する**

```ts
trigger: {
  kind: "new-requirement",
  situation: "これまでの設計判断を使って、小さな追加機能へ対応します。",
  requirement: "検査後に電話フォローが必要な患者を抽出します。",
},
invariant: "既存の状態、境界、Result、event の設計を崩さず、1関数で要求を受け止めます。",
technique: {
  name: "既習技法の統合",
  reason: "状態、入力境界、Sensitive、Result、domain event の判断を1つの use case で接続します。",
  limits: "新しい抽象化や型テクニックは追加しません。",
},
editTargets: [
  { file: "src/clinic/use-cases.ts", symbol: "collectFollowUpTargets" },
],
reflectionQuestions: [
  "電話フォロー要求の各制約は、型、境界、Result、event、レビューのどこで守られていますか。",
],
fallbackGuidance: "collectFollowUpTargets の対象判定を一つずつ確認します。時間が足りない場合は worked example に切り替え、petId mismatch、PII、Result、event を確認します。",
workedExamples: [
  { file: "src/clinic/use-cases.ts", symbols: ["collectFollowUpTargets"] },
],
finalActionPlan: {
  implementationPrompt: "自分の業務コードで最初に見直す実装箇所を書いてください。",
  firstActionPrompt: "その箇所で最初に試す行動を書いてください。",
},
```

Red と Green は `exercise:05`、編集対象は `collectFollowUpTargets` だけです。

- [ ] **Step 4: `modules.ts` をレジストリへ置き換える**

```ts
export const modules = [
  breakTheAppModule,
  readTheIncidentModule,
  stateModelingModule,
  boundaryAndIdsModule,
  resultErrorsModule,
  agentReviewModule,
  miniIntegrationModule,
] as const satisfies readonly ModuleContent[];

export const moduleBySlug = (slug: string): ModuleContent | undefined =>
  modules.find((module) => module.slug === slug);

export const moduleNeighbors = (slug: string): {
  previous?: ModuleContent;
  next?: ModuleContent;
} => {
  const index = modules.findIndex((module) => module.slug === slug);
  if (index < 0) return {};
  const previous = modules[index - 1];
  const next = modules[index + 1];
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
};
```

- [ ] **Step 5: 未接続の旧レンダラーを退役させる**

旧 `main.ts` は現在の静的 `index.html` から読み込まれていません。旧コンテンツ型への参照を残さないよう、Task 9 でアプリを接続するまで次の内容にします。

```ts
import "./styles/base.css";

export {};
```

`module-card.ts` も新しい型でコンパイルできる最小実装へ移します。リンクと完成版レイアウトは Task 8 で追加します。

```ts
import type { ModuleContent } from "../content/module-content";

export const renderModuleCard = (module: ModuleContent): HTMLElement => {
  const card = document.createElement("article");
  card.dataset.moduleCard = "";
  const heading = document.createElement("h2");
  heading.textContent = module.title;
  card.append(heading);
  return card;
};
```

この変更では配信中の静的トップと静的 Module 00 の挙動は変わりません。

- [ ] **Step 6: レジストリ、全コンテンツ契約、型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/content/modules.test.ts src/content/modules/*.test.ts`

Expected: PASS for all 7 modules.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add apps/docs/src/content/modules.ts apps/docs/src/content/modules/05-mini-integration.ts apps/docs/src/content/modules.test.ts apps/docs/src/main.ts apps/docs/src/components/module-card.ts
git commit -m "feat(docs): 7モジュールをPRD準拠のレジストリへ統合"
```

---

### Task 6: 通常パスのルート解析を実装する

**Files:**
- Create: `apps/docs/src/routes.ts`
- Test: `apps/docs/src/routes.test.ts`

**Interfaces:**
- Consumes: `moduleBySlug(slug: string)`
- Produces: `Route`
- Produces: `normalizePathname(pathname: string): string`
- Produces: `modulePath(module: ModuleContent): string`
- Produces: `resolveRoute(pathname: string): Route`

- [ ] **Step 1: 正規 URL、互換 URL、404 の失敗テストを書く**

```ts
expect(resolveRoute("/")).toEqual({ kind: "home", canonicalPath: "/" });
expect(resolveRoute("/modules/01-state-modeling")).toMatchObject({
  kind: "module",
  canonicalPath: "/modules/01-state-modeling/",
  module: { slug: "01-state-modeling" },
});
expect(resolveRoute("/module-00/")).toMatchObject({
  kind: "module",
  canonicalPath: "/modules/00-break-the-app/",
  module: { slug: "00-break-the-app" },
});
expect(resolveRoute("/modules/missing/")).toEqual({
  kind: "not-found",
  pathname: "/modules/missing/",
});
const firstModule = moduleBySlug("00-break-the-app");
expect(firstModule).toBeDefined();
if (firstModule === undefined) throw new Error("00-break-the-app is missing");
expect(modulePath(firstModule)).toBe("/modules/00-break-the-app/");
```

- [ ] **Step 2: テストを実行してルーター未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/routes.test.ts`

Expected: FAIL with missing `routes.ts`.

- [ ] **Step 3: 純粋なルート解析を実装する**

```ts
export type Route =
  | Readonly<{ kind: "home"; canonicalPath: "/" }>
  | Readonly<{ kind: "module"; canonicalPath: string; module: ModuleContent }>
  | Readonly<{ kind: "not-found"; pathname: string }>;

export const normalizePathname = (pathname: string): string => {
  if (pathname === "/") return "/";
  return `/${pathname.split("/").filter(Boolean).join("/")}/`;
};

export const modulePath = (module: ModuleContent): string =>
  `/modules/${module.slug}/`;

export const resolveRoute = (pathname: string): Route => {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return { kind: "home", canonicalPath: "/" };
  if (normalized === "/module-00/") {
    const module = moduleBySlug("00-break-the-app");
    if (module !== undefined) return { kind: "module", canonicalPath: modulePath(module), module };
  }
  const match = /^\/modules\/([^/]+)\/$/.exec(normalized);
  const module = match?.[1] === undefined ? undefined : moduleBySlug(match[1]);
  return module === undefined
    ? { kind: "not-found", pathname: normalized }
    : { kind: "module", canonicalPath: modulePath(module), module };
};
```

- [ ] **Step 4: テストと型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/routes.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/routes.ts apps/docs/src/routes.test.ts
git commit -m "feat(docs): 通常パスのルート解析を追加"
```

---

### Task 7: 共通コンテンツブロックとモジュールページを実装する

**Files:**
- Create: `apps/docs/src/components/content-block.ts`
- Modify: `apps/docs/src/components/code-block.ts:1`
- Create: `apps/docs/src/pages/module-page.ts`
- Create: `apps/docs/src/pages/not-found-page.ts`
- Test: `apps/docs/src/components/content-block.test.ts`
- Test: `apps/docs/src/pages/module-page.test.ts`

**Interfaces:**
- Consumes: `ContentBlock`, `ModuleContent`, `moduleNeighbors`, `modulePath`
- Produces: `renderContentBlock(block: ContentBlock): HTMLElement`
- Produces: `renderModulePage(module: ModuleContent): HTMLElement`
- Produces: `renderNotFoundPage(pathname: string): HTMLElement`

- [ ] **Step 1: 全ブロック種別の失敗テストを書く**

```ts
const blocks: readonly ContentBlock[] = [
  { kind: "prose", heading: "要求", paragraphs: ["変更内容を確認します。"] },
  { kind: "code", heading: "型", language: "ts", code: "type Status = 'paid';" },
  { kind: "command", phase: "red", command: "pnpm exercise:01", expected: "FAIL" },
  {
    kind: "file-table",
    heading: "読むファイル",
    rows: [{ file: "src/a.ts", focus: "状態", mode: "read" }],
  },
  { kind: "checklist", heading: "完了条件", items: ["型検査が通ります。"] },
];

for (const block of blocks) {
  const element = renderContentBlock(block);
  expect(element.textContent?.trim().length).toBeGreaterThan(0);
}
```

- [ ] **Step 2: モジュールページの失敗テストを書く**

```ts
const page = renderModulePage(stateModelingModule);
expect(page.querySelector("h1")?.textContent).toContain("状態遷移を型にする");
expect(page.textContent).toContain("新しい要求");
expect(page.textContent).toContain("この技法で解決しない範囲");
expect(page.textContent).toContain("業務への転用");
expect(page.querySelectorAll("[data-edit-target]")).toHaveLength(2);
expect(page.querySelector('[rel="prev"]')).not.toBeNull();
expect(page.querySelector('[rel="next"]')).not.toBeNull();

const finalPage = renderModulePage(miniIntegrationModule);
expect(finalPage.querySelector('textarea[name="implementation-location"]')).not.toBeNull();
expect(finalPage.querySelector('textarea[name="first-action"]')).not.toBeNull();
```

- [ ] **Step 3: テストを実行してレンダラー未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/content-block.test.ts src/pages/module-page.test.ts`

Expected: FAIL with missing renderer modules.

- [ ] **Step 4: `renderContentBlock` を網羅的に実装する**

各 `kind` で意味に合う要素を作り、default では `never` を要求します。

```ts
const assertNever = (value: never): never => {
  throw new Error(`Unsupported content block: ${JSON.stringify(value)}`);
};

export const renderContentBlock = (block: ContentBlock): HTMLElement => {
  switch (block.kind) {
    case "prose":
      return renderProse(block);
    case "code":
      return renderCodeBlock(block.heading, block.code, block.language);
    case "command":
      return renderCommandBlock(block);
    case "file-table":
      return renderFileTable(block);
    case "checklist":
      return renderChecklist(block);
    default:
      return assertNever(block);
  }
};
```

- [ ] **Step 5: 共通詳細ページと404を実装する**

`renderModulePage` は、ヘッダー、ヒーロー、起点、不変条件、ミッション、Red、編集対象、Green、技法の理由と限界、本文、レビュー、完了条件、振り返り、代替進行、参考リンク、前後ナビゲーションの順に組み立てます。

`finalActionPlan` がある場合だけ、`implementation-location` と `first-action` の2つの textarea をラベル付きで表示します。入力内容は送信も永続化もしません。

起点の見出しは次の対応にします。

```ts
const triggerHeading = (trigger: ModuleTrigger): string => {
  switch (trigger.kind) {
    case "incident": return "事故";
    case "new-requirement": return "新しい要求";
    case "review": return "レビュー要求";
  }
};
```

`renderNotFoundPage` は pathname、トップへのリンク、モジュール一覧へのリンクを表示します。

- [ ] **Step 6: テストと型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/content-block.test.ts src/pages/module-page.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS with no legacy content-shape errors.

- [ ] **Step 7: コミットする**

```bash
git add apps/docs/src/components/code-block.ts apps/docs/src/components/content-block.ts apps/docs/src/components/content-block.test.ts apps/docs/src/pages/module-page.ts apps/docs/src/pages/module-page.test.ts apps/docs/src/pages/not-found-page.ts
git commit -m "feat(docs): PRDコンテンツの共通ページレンダラーを追加"
```

---

### Task 8: トップページを SPA のホーム画面へ移す

**Files:**
- Create: `apps/docs/src/content/home.ts`
- Create: `apps/docs/src/pages/home-page.ts`
- Modify: `apps/docs/src/components/module-card.ts:1`
- Test: `apps/docs/src/pages/home-page.test.ts`
- Source: `apps/docs/index.html:1451-1713`

**Interfaces:**
- Consumes: `modules`, `modulePath`
- Produces: `homeContent`
- Produces: `renderHomePage(): HTMLElement`

- [ ] **Step 1: PRD-01と7件の導線の失敗テストを書く**

```ts
const page = renderHomePage();
expect(page.querySelector("h1")?.textContent).toContain("FP with TypeScript");
expect(page.textContent).toContain("全面刷新せず");
expect(page.textContent).toContain("1〜2関数");
expect(page.querySelectorAll("[data-module-card]")).toHaveLength(7);
expect(
  Array.from(page.querySelectorAll<HTMLAnchorElement>("[data-module-card] a"))
    .map(({ pathname }) => pathname),
).toEqual(modules.map(modulePath));
```

- [ ] **Step 2: テストを実行してホーム画面未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/pages/home-page.test.ts`

Expected: FAIL with missing `home-page.ts`.

- [ ] **Step 3: ホームの文章と画面を実装する**

ホームの主メッセージを次に固定します。

```ts
export const homeContent = {
  title: "FP with TypeScript — 動物病院ハンズオン",
  lead: "既存コードを全面刷新せず、1〜2関数の局所変更から変更容易性を高めます。",
  promise: "要求または事故を読み、不変条件を見つけ、技法を選び、テストまたは型検査で効果を確認します。",
} as const;
```

現行 `index.html` の対象者、学習の流れ、開催情報、参加前の準備、参考情報を `homeContent` へ移し、インライン HTML と CSS は残しません。モジュールカードは `modulePath` だけで href を生成します。

- [ ] **Step 4: ホーム画面テストと型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/pages/home-page.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/content/home.ts apps/docs/src/pages/home-page.ts apps/docs/src/pages/home-page.test.ts apps/docs/src/components/module-card.ts
git commit -m "feat(docs): ランディング内容をSPAホームへ移行"
```

---

### Task 9: History API と Workers の SPA fallback へ接続する

**Files:**
- Create: `apps/docs/src/app.ts`
- Test: `apps/docs/src/app.test.ts`
- Modify: `apps/docs/src/main.ts:1`
- Modify: `apps/docs/index.html:1-1713`

**Interfaces:**
- Consumes: `resolveRoute`, `renderHomePage`, `renderModulePage`, `renderNotFoundPage`
- Produces: `startApp(root: HTMLElement, browserWindow?: Window): () => void`

- [ ] **Step 1: 初回表示と404の失敗テストを書く**

```ts
window.history.replaceState({}, "", "/modules/01-state-modeling/");
const root = document.createElement("div");
const stop = startApp(root, window);
expect(root.querySelector("h1")?.textContent).toContain("状態遷移を型にする");
stop();

window.history.replaceState({}, "", "/missing/");
const missingRoot = document.createElement("div");
startApp(missingRoot, window);
expect(missingRoot.textContent).toContain("ページが見つかりません");
```

- [ ] **Step 2: クリック、戻る、互換ルートの失敗テストを書く**

```ts
window.history.replaceState({}, "", "/module-00/");
const root = document.createElement("div");
const stop = startApp(root, window);
expect(window.location.pathname).toBe("/modules/00-break-the-app/");

const next = root.querySelector<HTMLAnchorElement>('[rel="next"]');
next?.click();
expect(window.location.pathname).toBe("/modules/00-read-the-incident/");

window.history.back();
window.dispatchEvent(new PopStateEvent("popstate"));
expect(root.querySelector("h1")?.textContent).toContain("導入事故");
stop();
```

- [ ] **Step 3: テストを実行してアプリ連携未作成の失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/app.test.ts`

Expected: FAIL with missing `app.ts`.

- [ ] **Step 4: `startApp` を実装する**

`startApp` は次の処理だけを担当します。

```ts
const render = (): void => {
  const route = resolveRoute(browserWindow.location.pathname);
  if (route.kind !== "not-found" && route.canonicalPath !== browserWindow.location.pathname) {
    browserWindow.history.replaceState({}, "", route.canonicalPath);
  }
  root.replaceChildren(
    route.kind === "home"
      ? renderHomePage()
      : route.kind === "module"
        ? renderModulePage(route.module)
        : renderNotFoundPage(route.pathname),
  );
  browserWindow.scrollTo({ top: 0 });
  root.querySelector<HTMLElement>("h1")?.focus();
};
```

クリック処理は左クリック、修飾キーなし、同一オリジン、`target` なしのアンカーだけを横取りします。`popstate` と click listener を解除する cleanup 関数を返します。

- [ ] **Step 5: `main.ts` と Vite エントリを接続する**

`index.html` は次のアプリシェルへ置き換えます。

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="関数型ドメインモデリングをTypeScriptで体験する動物病院ハンズオン" />
    <title>FP with TypeScript</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`main.ts` は `base.css` を import し、`#app` がない場合は明確なエラーを投げ、`startApp` を呼びます。

- [ ] **Step 6: アプリ連携テストとビルドを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/app.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: Vite emits `dist/index.html` and hashed SPA assets. The legacy static Module 00 remains only until its CSS migration in Task 10 is verified.

- [ ] **Step 7: コミットする**

```bash
git add apps/docs/src/app.ts apps/docs/src/app.test.ts apps/docs/src/main.ts apps/docs/index.html
git commit -m "feat(docs): 通常パスのSPAルーターを配信入口へ接続"
```

---

### Task 10: Module 00 のデザインを共通 CSS へ移す

**Files:**
- Modify: `apps/docs/src/styles/base.css:1`
- Modify: `apps/docs/src/pages/module-page.test.ts`
- Delete: `apps/docs/public/module-00/index.html`
- Source: `apps/docs/public/module-00/index.html:1-396`

**Interfaces:**
- Consumes: Task 7〜9 が出力する class 名
- Produces: 1440px と 390px で共通利用するデザイントークンとレスポンシブ CSS

- [ ] **Step 1: DOM構造とproduction buildの移行前baselineを確認する**

ページテストには、`header`、`nav`、`main`、フォーカス可能な `h1`、`rel="prev"`、`rel="next"` の存在確認を追加します。CSSのソース文字列はテストしません。2026年8月5日にユーザーが承認したTDD例外として、CSSは実画面で検証します。

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/pages/module-page.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS.

- [ ] **Step 2: 共通デザイントークンと部品スタイルを移す**

最低限、次の構造を `base.css` に含めます。

```css
:root {
  color-scheme: light;
  --color-text: #14213d;
  --color-muted: #52606d;
  --color-surface: #ffffff;
  --color-accent: #e76f51;
  --color-border: #d9e2ec;
  --content-width: 72rem;
}

.page-shell {
  width: min(100% - 2rem, var(--content-width));
  margin-inline: auto;
}

.code-block,
.command-card,
.file-table-wrapper {
  overflow-x: auto;
}

@media (max-width: 700px) {
  .module-hero,
  .module-navigation {
    grid-template-columns: 1fr;
  }
}
```

既存 Module 00 のヘッダー、ヒーロー、目次、状況、ミッション、コマンド、ファイル表、チェックリスト、前後ナビゲーションを上記トークンへ接続します。動物名や事故固有のセレクターは作りません。

- [ ] **Step 3: 自動テストとビルドを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/pages/module-page.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS.

- [ ] **Step 4: 1440px と 390px で全ページを確認する**

Run: `pnpm --filter @fp-with-ts/docs dev`

確認対象:

- `/`
- `/modules/00-break-the-app/`
- `/modules/00-read-the-incident/`
- `/modules/01-state-modeling/`
- `/modules/02-boundary-and-ids/`
- `/modules/03-result-errors/`
- `/modules/04-agent-review/`
- `/modules/05-mini-integration/`
- `/missing/`

Expected: ページ全体の横スクロールがなく、コードと表だけが必要に応じて横スクロールします。前後ナビゲーションは390pxで縦並びになります。

- [ ] **Step 5: 移行済みの旧静的ページを削除する**

Task 2 でコンテンツ、Task 10 でスタイルを移したことを差分と画面で確認してから削除します。

Run: `git rm apps/docs/public/module-00/index.html`

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: `dist/index.html` と hashed assets が生成され、`dist/module-00/index.html` は生成されません。

- [ ] **Step 6: コミットする**

```bash
git add apps/docs/src/styles/base.css apps/docs/src/pages/module-page.test.ts
git commit -m "style(docs): Module 00のデザインを全ページへ共通化"
```

---

### Task 11: PRD 適合テストと全経路の回帰確認を完了する

**Files:**
- Create: `apps/docs/src/prd-coverage.test.ts`
- Modify: `apps/docs/src/content/module-content.test.ts`
- Modify: `apps/docs/src/content/modules.test.ts`
- Modify: `apps/docs/src/app.test.ts`
- Verify only: `worker/index.ts`
- Verify only: `wrangler.jsonc`

**Interfaces:**
- Consumes: `modules`, `renderHomePage`, `renderModulePage`, `resolveRoute`
- Produces: PRD-01〜PRD-10 と PRD-12 の実行可能な対応表

- [ ] **Step 1: PRD 全体の失敗テストを書く**

```ts
describe("PRD coverage", () => {
  it("PRD-01: ホームが段階的改善を説明する", () => {
    expect(renderHomePage().textContent).toContain("全面刷新せず");
  });

  it("PRD-02〜08、12: 全モジュールが共通契約を満たす", () => {
    for (const module of modules) {
      expect(() => assertModuleMeetsPrd(module)).not.toThrow();
      expect(renderModulePage(module).textContent).toContain(module.invariant);
    }
  });

  it("PRD-09〜10: 最終演習が一巡と行動計画を含む", () => {
    const finalModule = moduleBySlug("05-mini-integration");
    expect(finalModule).toBeDefined();
    if (finalModule === undefined) throw new Error("05-mini-integration is missing");
    expect(finalModule.editTargets).toHaveLength(1);
    expect(finalModule.finalActionPlan).toBeDefined();
    const page = renderModulePage(finalModule);
    expect(page.textContent).toContain("最初に見直す実装箇所");
    expect(page.textContent).toContain("最初に試す行動");
    expect(page.querySelector('textarea[name="implementation-location"]')).not.toBeNull();
    expect(page.querySelector('textarea[name="first-action"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: PRD 適合テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/prd-coverage.test.ts`

Expected: PASS. PRD-11 はテスト対象に含めません。

- [ ] **Step 3: 全自動検証を実行する**

Run: `pnpm typecheck`

Expected: PASS.

Run: `pnpm test`

Expected: docs tests and clinic-example 11 normal tests PASS. Exercise tests are not included.

Run: `pnpm build`

Expected: PASS and `apps/docs/dist/index.html` is the single HTML entry.

- [ ] **Step 4: Workers 経由の直リンクを確認する**

Run: `pnpm cf:dev`

別のシェルから次を確認します。

```bash
curl --fail http://localhost:8787/
curl --fail http://localhost:8787/modules/00-break-the-app/
curl --fail http://localhost:8787/modules/05-mini-integration/
curl --fail http://localhost:8787/module-00/
curl --fail http://localhost:8787/missing/
curl --fail http://localhost:8787/healthz
```

Expected: HTML routes return the SPA shell, `/healthz` returns its existing health response, and browser verification shows the correct rendered page for every pathname.

- [ ] **Step 5: Worker 設定が変更されていないことを確認する**

Run: `git diff --exit-code origin/main -- worker/index.ts wrangler.jsonc`

Expected: no diff.

- [ ] **Step 6: 最終差分を確認してコミットする**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add apps/docs/src/prd-coverage.test.ts apps/docs/src/content/module-content.test.ts apps/docs/src/content/modules.test.ts apps/docs/src/app.test.ts
git commit -m "test(docs): PRD適合と全ルートの回帰を保証"
```

---

## PRD Traceability

| PRD | 実装タスク | 主な検証 |
| --- | --- | --- |
| PRD-01 | Task 8、11 | ホームの段階的改善メッセージ |
| PRD-02 | Task 1〜5、11 | 起点と不変条件の契約 |
| PRD-03 | Task 1〜5、7、11 | Red コマンドと期待結果 |
| PRD-04 | Task 1〜5、7、11 | 技法名、適用理由、画面表示 |
| PRD-05 | Task 1〜5、7、11 | 技法の限界、画面表示 |
| PRD-06 | Task 1〜5、11 | 編集対象が最大2件 |
| PRD-07 | Task 1〜5、7、11 | Green コマンドと期待結果 |
| PRD-08 | Task 1〜5、7、11 | 各モジュールの振り返り設問 |
| PRD-09 | Task 5、11 | 最終演習の統合フロー |
| PRD-10 | Task 5、7、11 | 最終行動計画の2設問 |
| PRD-11 | 対象外 | 設計書と計画書に承認済み例外を記録 |
| PRD-12 | Task 1〜5、7、11 | 各モジュールの代替進行 |

## Final Verification

- `git status --short` が空、または意図した未コミット差分だけであることを確認します。
- `pnpm typecheck`、`pnpm test`、`pnpm build` の成功ログを残します。
- 正規 URL 8件、互換 URL 1件、404 1件をブラウザで確認します。
- 1440px と 390px のスクリーンショットを比較し、ページ全体に横スクロールがないことを確認します。
- 設計書の完了条件と PRD Traceability を1項目ずつ照合します。
