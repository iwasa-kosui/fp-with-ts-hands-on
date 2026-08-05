# Module 00 オンボーディング階層化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Module 00 の導入を、初見では上から読め、後からは目次で各区画を参照できる 1 つのオンボーディング章へ再構成する。

**Architecture:** Module 00 専用の `OnboardingChapter` を `ModuleContent` に追加し、通常の `ContentBlock` とは別のレンダラーで H2/H3/H4 の親子構造を描画する。ページはオンボーディングを 1 つの親 `section` として配置し、目次は `section` の親子関係から入れ子のリストを作る。既存モジュールは従来の H2 と平坦な目次を維持する。

**Tech Stack:** TypeScript、DOM API、Vitest、Happy DOM、CSS、Vite

## Global Constraints

- Module 00 の導入見出しは、承認済みの順で `開発に参加する前に`、`動物病院の役割`、`1回の来院の流れ`、`登場人物`、`提供する機能と価値`、`来院をモデリングしよう`、`開発者として今日取り組むこと` を使う。
- `1回の来院の流れ` は `ol`、登場人物は役割を説明するリスト、機能と価値は `機能`・`利用者`・`価値` の表で表す。
- 導入の外側だけをカードとして表示し、内部の区画を独立したカードにしない。
- `業務事故`、`状態値`、`再診の正規操作`、`状態モデリング`、`Agent Review`、`赤テスト`などの直訳調・造語調の表現を導入本文へ入れない。
- 再診の通常の手順は、今回の演習対象外とだけ説明し、新しい業務手順を定義しない。
- Module 01 以降のコンテンツ構造、表示順、目次を変更しない。
- `.superpowers/` の未追跡ファイルをステージまたはコミットしない。

---

## File Structure

- Modify: `apps/docs/src/content/module-content.ts` — Module 00専用オンボーディング章の型と `ModuleContent.onboarding` を追加し、ページ切替まで既存の `introBlocks` を互換として保持する。
- Modify: `apps/docs/src/components/content-block.ts` — オンボーディング章を意味に合うHTMLで描画する `renderOnboardingChapter` を公開する。
- Modify: `apps/docs/src/components/content-block.test.ts` — H2/H3/H4、順番のあるリスト、人物リスト、表、来院の進み具合を単体テストする。
- Modify: `apps/docs/src/content/modules/00-break-the-app.ts` — 平坦な `introBlocks` を承認済みのオンボーディング章へ移行する。
- Modify: `apps/docs/src/content/modules/00-introduction.test.ts` — Module 00 の内容・順序・禁止用語をテストする。
- Modify: `apps/docs/src/pages/module-page.ts` — 親子 `section` から入れ子の目次を作り、オンボーディング章を先頭に配置する。
- Modify: `apps/docs/src/pages/module-page.test.ts` — ページ上の階層、目次、Module 01の非回帰をテストする。
- Modify: `apps/docs/src/styles/base.css` — 外側1枚だけの装飾、内部の区切り、入れ子目次を定義する。

## Task 1: オンボーディング章の型と意味論的レンダラー

**Files:**
- Modify: `apps/docs/src/content/module-content.ts`
- Modify: `apps/docs/src/components/content-block.ts`
- Test: `apps/docs/src/components/content-block.test.ts`

**Interfaces:**
- Consumes: 既存の `ContentBlock` と `renderContentBlock`。通常の実習ブロックはこの契約を維持する。
- Produces: `OnboardingChapter`、`OnboardingSection`、`renderOnboardingChapter(chapter: OnboardingChapter): HTMLElement`。

- [x] **Step 1: オンボーディング章の失敗テストを書く**

  `content-block.test.ts` に `renderOnboardingChapter` のテストを追加する。最小のフィクスチャは次の形にする。

  ```ts
  const chapter: OnboardingChapter = {
    id: "before-joining",
    heading: "開発に参加する前に",
    sections: [
      { kind: "business-context", id: "hospital-role", heading: "動物病院の役割", paragraphs: ["飼い主と病院スタッフを支えます。"] },
      {
        kind: "visit-flow",
        id: "visit-flow",
        heading: "1回の来院の流れ",
        introduction: "来院の順番を確認します。",
        steps: [{ title: "予約", description: "飼い主が予約する。" }],
        people: {
          id: "people",
          heading: "登場人物",
          items: [{ name: "飼い主", description: "診察を予約する。" }],
        },
      },
      { kind: "value-map", id: "function-and-value", heading: "提供する機能と価値", introduction: "対応を確認します。", rows: [{ function: "予約・受付", audiences: "飼い主", value: "迷わず来院できる。" }] },
      { kind: "visit-model", id: "visit-modeling", heading: "来院をモデリングしよう", introduction: "進み具合を記録します。", states: [{ label: "予約済み", code: "scheduled" }], rule: "会計済みの来院を診察中へ戻さない。" },
      { kind: "developer-guide", id: "developer-task", heading: "開発者として今日取り組むこと", introduction: "コードを確認します。", items: [{ title: "src/legacy", description: "現在の実装です。" }] },
    ],
  };
  const element = renderOnboardingChapter(chapter);

  expect(element.matches("section#before-joining.onboarding-chapter")).toBe(true);
  expect(element.querySelector(":scope > h2")?.textContent).toBe("開発に参加する前に");
  expect([...element.querySelectorAll(":scope > section > h3")].map(({ textContent }) => textContent))
    .toEqual(["動物病院の役割", "1回の来院の流れ", "提供する機能と価値", "来院をモデリングしよう", "開発者として今日取り組むこと"]);
  expect(element.querySelector("#visit-flow > ol > li")?.textContent).toContain("予約");
  expect(element.querySelector("#people > h4")?.textContent).toBe("登場人物");
  expect(element.querySelectorAll("#people li")).toHaveLength(1);
  expect([...element.querySelectorAll("#function-and-value th")].map(({ textContent }) => textContent))
    .toEqual(["機能", "利用者", "価値"]);
  ```

- [x] **Step 2: テストが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/components/content-block.test.ts`

  Expected: `renderOnboardingChapter` または `OnboardingChapter` が存在しないため失敗する。

- [x] **Step 3: 型を追加する**

  `module-content.ts` に次の型を追加し、`ModuleContent` に `onboarding?: OnboardingChapter` を追加する。このタスクでは既存の `introBlocks?: readonly ContentBlock[]` を残す。Module 00 のデータとページを同じコミットで切り替えるTask 3でのみ削除する。

  ```ts
  type OnboardingSectionBase = Readonly<{ id: string; heading: string }>;

  export type OnboardingChapter = Readonly<{
    id: string;
    heading: string;
    sections: readonly OnboardingSection[];
  }>;

  export type OnboardingSection =
    | (OnboardingSectionBase & Readonly<{ kind: "business-context"; paragraphs: readonly string[] }> )
    | (OnboardingSectionBase & Readonly<{
        kind: "visit-flow";
        introduction: string;
        steps: readonly Readonly<{ title: string; description: string }>[];
        people: Readonly<{
          id: string;
          heading: string;
          items: readonly Readonly<{ name: string; description: string }>[];
        }>;
      }>)
    | (OnboardingSectionBase & Readonly<{
        kind: "value-map";
        introduction: string;
        rows: readonly Readonly<{ function: string; audiences: string; value: string }>[];
      }>)
    | (OnboardingSectionBase & Readonly<{
        kind: "visit-model";
        introduction: string;
        states: readonly Readonly<{ label: string; code: string }>[];
        rule: string;
      }>)
    | (OnboardingSectionBase & Readonly<{
        kind: "developer-guide";
        introduction: string;
        items: readonly Readonly<{ title: string; description: string }>[];
      }>);
  ```

- [x] **Step 4: オンボーディング章を描画する**

  `content-block.ts` に `renderOnboardingChapter` を追加する。親を `section.onboarding-chapter`、親見出しを H2、各区画を直接の子 `section` とH3で作る。`visit-flow` は手順を `ol > li`、人物を `section` とH4および `dl > dt + dd`、`value-map` は `table`、`visit-model` はラベル・コードの対応リストとルール文、`developer-guide` は既存overviewと同じタイトル・説明のリストで描画する。

  ```ts
  export const renderOnboardingChapter = (chapter: OnboardingChapter): HTMLElement => {
    const section = document.createElement("section");
    section.id = chapter.id;
    section.className = "onboarding-chapter";
    section.append(heading(chapter.heading));
    for (const onboardingSection of chapter.sections) {
      section.append(renderOnboardingSection(onboardingSection));
    }
    return section;
  };
  ```

  `renderOnboardingSection` では既存の `assertNever` を使い、すべての `kind` を網羅する。利用者が読む文字列は `textContent` に設定し、`innerHTML` を使わない。

- [x] **Step 5: 単体テストを成功させる**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/components/content-block.test.ts`

  Expected: PASS。

- [x] **Step 6: コミットする**

  ```bash
  git add apps/docs/src/content/module-content.ts apps/docs/src/components/content-block.ts apps/docs/src/components/content-block.test.ts
  git commit -m "feat(docs): オンボーディング章を描画する"
  ```

## Task 2: Module 00の内容を階層化する

**Files:**
- Modify: `apps/docs/src/content/modules/00-break-the-app.ts`
- Modify: `apps/docs/src/content/modules/00-introduction.test.ts`

**Interfaces:**
- Consumes: Task 1 の `ModuleContent.onboarding` と `OnboardingChapter`。
- Produces: 承認済みの5区画と、その中の登場人物を持つ Module 00 データ。

- [x] **Step 1: Module 00の失敗テストを書く**

  `00-introduction.test.ts` で `breakTheAppModule.onboarding` を取得し、次を検証する。

  ```ts
  expect(module.onboarding?.heading).toBe("開発に参加する前に");
  expect(module.onboarding?.sections.map(({ kind }) => kind)).toEqual([
    "business-context",
    "visit-flow",
    "value-map",
    "visit-model",
    "developer-guide",
  ]);
  expect(module.onboarding?.sections.map(({ heading }) => heading)).toEqual([
    "動物病院の役割",
    "1回の来院の流れ",
    "提供する機能と価値",
    "来院をモデリングしよう",
    "開発者として今日取り組むこと",
  ]);
  ```

  `visit-flow` を `kind === "visit-flow"` で絞り込み、手順が `予約`、`受付`、`診察と記録`、`会計と完了` の順であること、人物が `飼い主`、`受付スタッフ`、`獣医師`、`会計担当` であることを確認する。`visit-model` では `scheduled`、`checked-in`、`in-examination`、`paid` を確認し、前者の区画にこれらの値がないことも確認する。

- [x] **Step 2: テストが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/content/modules/00-introduction.test.ts`

  Expected: 現在は `introBlocks` のため、`onboarding` がないか期待した区画順と一致せず失敗する。

- [x] **Step 3: Module 00データを移行する**

  `00-break-the-app.ts` に `onboarding` として次の内容を入れる。このタスクでは既存の `introBlocks` も残し、Task 3でページを切り替えるまで現在の表示を保つ。

  - `business-context`: 飼い主が安心して来院でき、病院スタッフが予約から会計までを一貫して扱えるようにすることを説明する。
  - `visit-flow`: 予約、受付、診察と記録、会計と完了を順に置く。再診は `通常の再診手順は今回の演習では扱いません。` とだけ説明する。
  - `people`: 飼い主、受付スタッフ、獣医師、会計担当の役割を置く。
  - `value-map`: 既存の4行を移し、列の利用者表記を `利用者` にする。
  - `visit-model`: 4つの利用者向けラベルをコード値に対応付け、`paid` を診察中へ戻さないルールを置く。
  - `developer-guide`: `src/legacy`、`exercises`、`test`、`src/clinic` と、システム障害を再現してから確認する流れを置く。

  以前に禁止した表現の不在もテストに追加する。

  ```ts
  expect(JSON.stringify(module.onboarding)).not.toMatch(
    /業務事故|状態値|再診の正規操作|状態モデリング|Agent Review|赤テスト/,
  );
  ```

- [x] **Step 4: コンテンツテストを成功させる**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/content/modules/00-introduction.test.ts`

  Expected: PASS。

- [x] **Step 5: コミットする**

  ```bash
  git add apps/docs/src/content/modules/00-break-the-app.ts apps/docs/src/content/modules/00-introduction.test.ts
  git commit -m "feat(docs): Module 00の導入を階層化する"
  ```

## Task 3: 階層化した目次と導入の表示を実装する

**Files:**
- Modify: `apps/docs/src/content/module-content.ts`
- Modify: `apps/docs/src/content/modules/00-break-the-app.ts`
- Modify: `apps/docs/src/pages/module-page.ts`
- Modify: `apps/docs/src/pages/module-page.test.ts`
- Modify: `apps/docs/src/styles/base.css`

**Interfaces:**
- Consumes: Task 1 の `renderOnboardingChapter` と、各オンボーディング区画の `id`。
- Produces: Module 00の入れ子目次、外側1枚だけの導入装飾、Module 01以降の平坦な目次の維持。

- [x] **Step 1: ページの失敗テストを書く**

  `module-page.test.ts` に次のアサーションを追加する。

  ```ts
  const main = page.querySelector("main")!;
  const onboarding = main.querySelector(":scope > section#before-joining")!;
  expect(onboarding.querySelector(":scope > h2")?.textContent).toBe("開発に参加する前に");
  expect([...onboarding.querySelectorAll(":scope > section > h3")].map(({ textContent }) => textContent))
    .toEqual([
      "動物病院の役割",
      "1回の来院の流れ",
      "提供する機能と価値",
      "来院をモデリングしよう",
      "開発者として今日取り組むこと",
    ]);
  expect(onboarding.querySelector("#people > h4")?.textContent).toBe("登場人物");
  expect([...main.querySelectorAll(":scope > section > h2")].map(({ textContent }) => textContent)[1])
    .toBe("事故");
  ```

  目次について、先頭リンクが `#before-joining`、その隣接する入れ子 `ol` が5区画へのリンクを持ち、`#visit-flow` の子リストが `#people` へのリンクを持つことを確認する。Module 01は子 `ol` を持たず、従来のトップレベル見出しを持つことを確認する。

- [x] **Step 2: テストが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/module-page.test.ts`

  Expected: オンボーディング章をページが描画せず、入れ子目次もないため失敗する。

- [x] **Step 3: ページと目次を実装する**

  `renderModulePage` で `module.onboarding` があるとき、`renderOnboardingChapter(module.onboarding)` を `trigger` より前に追加する。Module 00の `onboarding` が描画されるようになった同じ変更で、`00-break-the-app.ts` の互換用 `introBlocks` と `ModuleContent` の `introBlocks` を削除する。これにより、各コミットで型検査とページ表示の両方を保つ。

  目次用に、`section[id]` の直接の子 `section[id]` を再帰して次の形へ変換する関数を追加する。

  ```ts
  type TableOfContentsItem = Readonly<{
    id: string;
    label: string;
    children: readonly TableOfContentsItem[];
  }>;

  const collectTableOfContentsItems = (container: ParentNode): readonly TableOfContentsItem[] =>
    [...container.querySelectorAll(":scope > section[id]")].map((section) => ({
      id: section.id,
      label: section.querySelector(":scope > h2, :scope > h3, :scope > h4")?.textContent ?? section.id,
      children: collectTableOfContentsItems(section),
    }));
  ```

  既存の目次の要素生成を、この `children` を再帰して `ol > li > a` と子 `ol` を追加する実装へ置き換える。通常モジュールの各 `section` に子 `section` はないため、子 `ol` は作られず既存の平坦表示を維持する。

- [x] **Step 4: スタイルを実装する**

  `base.css` に、`.onboarding-chapter` を `main` 直下のカードとして扱う規則を追加する。`.onboarding-chapter > section` は `box-shadow`、角丸、交互背景を持たず、上の兄弟があるときだけ `border-top` と上余白を持つようにする。`#visit-flow > ol` は番号が読み取れる左余白を、`#people` は控えめな左余白を持つようにする。入れ子の目次は親より一段字下げし、親リンクと子リンクの行間を保つ。

- [x] **Step 5: ページテストを成功させる**

  Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/module-page.test.ts`

  Expected: PASS。

- [x] **Step 6: コミットする**

  ```bash
  git add apps/docs/src/content/module-content.ts apps/docs/src/content/modules/00-break-the-app.ts apps/docs/src/pages/module-page.ts apps/docs/src/pages/module-page.test.ts apps/docs/src/styles/base.css
  git commit -m "feat(docs): 導入の階層を目次に反映する"
  ```

## Task 4: 全体を検証し、実装計画を記録する

**Files:**
- Modify: `docs/superpowers/plans/2026-08-05-module-00-onboarding-hierarchy.md`

**Interfaces:**
- Consumes: Task 1からTask 3の実装。
- Produces: 検証済みのModule 00導入と、完了済みの実装計画。

- [x] **Step 1: 全体テストを実行する**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: PASS。

- [x] **Step 2: 型検査を実行する**

  Run: `pnpm --filter @fp-with-ts/docs typecheck`

  Expected: PASS。

- [x] **Step 3: ビルドを実行する**

  Run: `pnpm --filter @fp-with-ts/docs build`

  Expected: PASS。

- [x] **Step 4: 実装計画の完了項目を更新する**

  実行済みのチェックボックスを `[x]` に変え、各タスクの検証コマンドと結果を末尾に記録する。

- [x] **Step 5: コミットする**

  ```bash
  git add docs/superpowers/plans/2026-08-05-module-00-onboarding-hierarchy.md
  git commit -m "docs: Module 00導入の実装計画を記録する"
  ```

## Verification results

- `pnpm --filter @fp-with-ts/docs test` — PASS (11 test files, 96 tests passed)
- `pnpm --filter @fp-with-ts/docs typecheck` — PASS (`tsc --noEmit`, exit 0)
- `pnpm --filter @fp-with-ts/docs build` — PASS (`tsc --noEmit && vite build`, exit 0)
