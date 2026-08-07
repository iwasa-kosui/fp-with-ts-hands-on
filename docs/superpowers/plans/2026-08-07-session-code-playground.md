# Session Code Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8つのセッションページそれぞれで、対応する開始 snapshot をブラウザ内で編集・実行できる Code Playground を提供する。

**Architecture:** 既存の `CodeExplorer` React island と session workspace を、新しい `SessionCodePlayground.astro` が接続する。各セッションページはこのコンポーネントを、失敗と読むべきファイルを示した直後に個別配置する。実行環境の CSS はプレビュー固有の枠から取り出し、プレビューとセッションの双方が同じコンポーネント表示を使う。

**Tech Stack:** Astro 4、React 18、TypeScript、Vitest、Playwright、Monaco Editor、WebContainers

## Global Constraints

- 対象は `00-break-the-app`、`00-read-the-incident`、`01`〜`05`、`final` の8ページである。
- 各ページは、既存の slug に対応する `sessionWorkspaceFor(slug)` と `projectFilesFor(slug)` だけを使う。
- 参加者の編集内容はブラウザメモリ内だけに保持し、保存、共有、Workerへの送信、任意コマンド実行を追加しない。
- WebContainer の正式な対象ブラウザは現行の Chrome と Edge とし、未対応環境では既存の案内と `pnpm` 手順を残す。
- セッション本文の業務上の問題、exercise、通常テスト、コマンド、教材コードは変更しない。
- `/code-explorer/` は Session 00 の独立プレビューとして、既存の表示と操作を維持する。
- モジュールページの UI を変更するため、8 URL をモバイル幅とデスクトップ幅で確認する。

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/docs/src/components/code-explorer/SessionCodePlayground.astro` | slug から workspace と教材ファイルを解決し、セッション本文用の見出し、案内、React island を描画する。 |
| `apps/docs/src/components/code-explorer/SessionCodePlayground.test.ts` | 共通コンポーネントが snapshot ごとの初期ファイルと実行 island を正しく描画することを確認する。 |
| `apps/docs/src/styles/code-playground.css` | プレビューとセッションで共有するファイルツリー、エディタ、操作、出力のスタイルとテーマ変数を持つ。 |
| `apps/docs/src/pages/code-explorer.astro` | 共有スタイルを読み込み、既存プレビューを `code-playground` テーマで包む。 |
| `apps/docs/src/styles/code-explorer-preview.css` | プレビュー固有のヘッダーと導入文だけを残す。 |
| `apps/docs/src/pages/sessions/*.astro` | 各ページ固有の学習順序に `SessionCodePlayground` と目次リンクを挿入する。 |
| `apps/docs/src/test/pages/sessions/code-playground.test.ts` | 8ページすべての目次、snapshot、初期ファイル、React island の統合を確認する。 |
| `apps/docs/src/test/pages/sessions/*.test.ts` | 既存の見出し・目次契約へ「ブラウザで試す」を追加する。 |
| `apps/docs/e2e/session-code-playground.spec.ts` | 8ページをモバイル・デスクトップ幅で開き、Playground が表示され、横あふれしないことを確認する。 |

## Task 1: 共有のセッション用 Playground を作る

**Files:**
- Create: `apps/docs/src/components/code-explorer/SessionCodePlayground.astro`
- Create: `apps/docs/src/components/code-explorer/SessionCodePlayground.test.ts`
- Create: `apps/docs/src/styles/code-playground.css`
- Modify: `apps/docs/src/pages/code-explorer.astro:1-41`
- Modify: `apps/docs/src/styles/code-explorer-preview.css:1-303`

**Interfaces:**
- Consumes: `sessionWorkspaceFor(slug: string): SessionWorkspace` from `src/code-explorer/session-workspaces.ts`; `projectFilesFor(slug: string): ProjectFiles` from `src/code-explorer/project-files.ts`; `CodeExplorer` from `src/components/code-explorer/CodeExplorer.tsx`.
- Produces: `SessionCodePlayground` with `Props = Readonly<{ slug: string }>` and a section headed by `h2#code-playground`.

- [ ] **Step 1: Write the failing Astro component test**

Create `SessionCodePlayground.test.ts`. Render the component with `createAstroContainer` for the first and final snapshots. Verify the common heading and assistive label, the exact workspace slug and initial file, the existing workspace description, and the load-hydrated React island.

```ts
import { describe, expect, it } from "vitest";
import SessionCodePlayground from "./SessionCodePlayground.astro";
import { createAstroContainer } from "../../test/render-astro";

const cases = [
  {
    slug: "00-break-the-app",
    initialFile: "exercises/incident.test.ts",
    description: "事故を再現するテストと開始 snapshot を編集して実行します。",
  },
  {
    slug: "final",
    initialFile: "test/follow-up.test.ts",
    description: "全セッションを統合した完成 snapshot を編集して実行します。",
  },
] as const;

describe("SessionCodePlayground", () => {
  for (const example of cases) {
    it(`renders the ${example.slug} workspace`, async () => {
      const container = await createAstroContainer();
      const html = await container.renderToString(SessionCodePlayground, {
        props: { slug: example.slug },
      });
      const document = new DOMParser().parseFromString(html, "text/html");

      expect(document.querySelector("h2#code-playground")?.textContent).toContain(
        "ブラウザで試す",
      );
      expect(document.querySelector("section[aria-labelledby=\"code-playground\"]")).not.toBeNull();
      expect(document.querySelector(`[data-code-explorer=\"${example.slug}\"]`)).not.toBeNull();
      expect(document.body.textContent).toContain(example.initialFile);
      expect(document.body.textContent).toContain(example.description);
      expect(document.querySelector('astro-island[client="load"]')).not.toBeNull();
    });
  }
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/SessionCodePlayground.test.ts`

Expected: FAIL because `SessionCodePlayground.astro` does not exist.

- [ ] **Step 3: Implement the component and shared styles**

Create `SessionCodePlayground.astro` with exactly one public prop, `slug`. Resolve the workspace and files before rendering. Keep the operational copy explicit: edits remain only in this browser and the participant can use the existing command blocks if the browser cannot execute WebContainers.

```astro
---
import { CodeExplorer } from "./CodeExplorer";
import { projectFilesFor } from "../../code-explorer/project-files";
import { sessionWorkspaceFor } from "../../code-explorer/session-workspaces";
import "../../styles/code-playground.css";

type Props = Readonly<{ slug: string }>;

const { slug } = Astro.props;
const workspace = sessionWorkspaceFor(slug);
const projectFiles = projectFilesFor(slug);
---

<section class="session-code-playground code-playground" aria-labelledby="code-playground">
  <h2 id="code-playground">ブラウザで試す</h2>
  <p>このセッションの開始 snapshot を、ブラウザ内で編集して実行できます。</p>
  <p>編集内容はこのブラウザ内だけに保持されます。実行できない場合は、ページ内の <code>pnpm</code> 手順を使います。</p>
  <div data-code-explorer={workspace.slug}>
    <CodeExplorer client:load workspace={workspace} projectFiles={projectFiles} />
  </div>
</section>
```

Create `code-playground.css` by moving all reusable selectors currently rooted at `.code-explorer-preview` for these elements: `[data-code-explorer]`, `.code-explorer`, `.code-explorer__workspace`, its file-tree `nav`, `.code-explorer__editor`, `.code-explorer__monaco`, `.code-explorer__actions`, `.code-explorer__output`, focus state, disabled state, and the existing `47.99rem` breakpoint. Root them at `.code-playground` and use these scoped theme variables so session pages can inherit the case-file palette without affecting the rest of the site:

```css
.code-playground {
  --playground-text: var(--color-text);
  --playground-surface: var(--color-surface);
  --playground-background: var(--color-background);
  --playground-primary: var(--color-primary);
  --playground-highlight: var(--color-highlight);
  --playground-danger: var(--color-accent-text);
  --playground-focus: var(--color-focus);
  --playground-lemon: var(--color-lemon);
  --playground-code: var(--color-code);
  --playground-border: var(--color-border);
  --playground-shadow: var(--shadow-hard);
}

.case-file .code-playground {
  --playground-text: var(--case-ink);
  --playground-surface: var(--case-paper);
  --playground-background: var(--case-mint);
  --playground-primary: var(--case-line);
  --playground-highlight: var(--case-mint);
  --playground-danger: var(--case-coral);
  --playground-focus: var(--case-coral);
  --playground-lemon: var(--case-lemon);
  --playground-code: var(--case-ink);
  --playground-border: var(--case-line);
  --playground-shadow: 0.375rem 0.375rem 0 var(--case-line);
}
```

Use the `--playground-*` variables in every moved declaration. Keep the two-column grid and 32rem editor height on desktop; keep the existing one-column, 24rem editor-height mobile rules. Do not change `CodeExplorer.tsx`.

Include the session wrapper's overflow guards in this shared stylesheet so the later browser test begins from the intended responsive behavior:

```css
.session-code-playground,
.session-code-playground [data-code-explorer] {
  min-width: 0;
}

.code-playground .code-explorer__workspace nav button > span:first-child {
  overflow-wrap: anywhere;
}
```

In `code-explorer.astro`, import `../styles/code-playground.css` and add `code-playground` to the existing main shell class. Remove only the moved reusable rules from `code-explorer-preview.css`; retain the preview page's outer layout, header, intro, eyebrow, and notice styles unchanged.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/SessionCodePlayground.test.ts`

Expected: PASS for both snapshot cases; the existing preview page is not changed semantically.

- [ ] **Step 5: Run the existing preview-page contract test**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/code-explorer.test.ts`

Expected: PASS; the standalone Session 00 preview still has its navigation, notice, reset/run controls, load-hydrated island, and `data-code-explorer="00-break-the-app"`.

- [ ] **Step 6: Commit the shared component and style extraction**

```bash
git add apps/docs/src/components/code-explorer/SessionCodePlayground.astro apps/docs/src/components/code-explorer/SessionCodePlayground.test.ts apps/docs/src/styles/code-playground.css apps/docs/src/pages/code-explorer.astro apps/docs/src/styles/code-explorer-preview.css
git commit -m "feat(docs): add session code playground"
```

## Task 2: セッション本文へ Playground を個別に配置する

**Files:**
- Modify: `apps/docs/src/pages/sessions/00-break-the-app.astro`
- Modify: `apps/docs/src/pages/sessions/00-read-the-incident.astro`
- Modify: `apps/docs/src/pages/sessions/01-state-modeling.astro`
- Modify: `apps/docs/src/pages/sessions/02-boundary-and-ids.astro`
- Modify: `apps/docs/src/pages/sessions/03-result-errors.astro`
- Modify: `apps/docs/src/pages/sessions/04-agent-review.astro`
- Modify: `apps/docs/src/pages/sessions/05-mini-integration.astro`
- Modify: `apps/docs/src/pages/sessions/final.astro`
- Create: `apps/docs/src/test/pages/sessions/code-playground.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/session-00.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/sessions-01-02.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/sessions-03-04.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/session-05.test.ts`

**Interfaces:**
- Consumes: `SessionCodePlayground` with `slug: string`, and the existing `session.slug` constant already declared by each page.
- Produces: one `h2#code-playground`, one matching link in each desktop/mobile table of contents, and one `data-code-explorer` whose value is the page's slug.

- [ ] **Step 1: Write the failing all-session integration test**

Create `code-playground.test.ts`. Import all eight page components, render each through `createAstroContainer`, and assert the common contract. The expected initial files must be the current workspace definitions, not paths copied from the prose.

```ts
const pages = [
  { slug: "00-break-the-app", Page: BreakTheAppPage, initialFile: "exercises/incident.test.ts" },
  { slug: "00-read-the-incident", Page: ReadTheIncidentPage, initialFile: "test/setup.test.ts" },
  { slug: "01-state-modeling", Page: StateModelingPage, initialFile: "exercises/state-modeling.test.ts" },
  { slug: "02-boundary-and-ids", Page: BoundaryAndIdsPage, initialFile: "exercises/boundary-and-ids.test.ts" },
  { slug: "03-result-errors", Page: ResultErrorsPage, initialFile: "exercises/result-errors.test.ts" },
  { slug: "04-agent-review", Page: AgentReviewPage, initialFile: "exercises/agent-review.test.ts" },
  { slug: "05-mini-integration", Page: MiniIntegrationPage, initialFile: "exercises/follow-up.test.ts" },
  { slug: "final", Page: FinalPage, initialFile: "test/follow-up.test.ts" },
] as const;

for (const { slug, Page, initialFile } of pages) {
  it(`renders ${slug}'s playground and table-of-contents entry`, async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(Page, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("article h2#code-playground")?.textContent).toBe("ブラウザで試す");
    expect(document.querySelector(`[data-code-explorer=\"${slug}\"]`)).not.toBeNull();
    expect(document.body.textContent).toContain(initialFile);
    expect(document.querySelectorAll('nav[aria-label="ページ内目次"] a[href="#code-playground"]')).toHaveLength(2);
    expect(document.querySelectorAll('astro-island[client="load"]')).toHaveLength(1);
  });
}
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/sessions/code-playground.test.ts`

Expected: FAIL because no session page imports or renders `SessionCodePlayground` yet.

- [ ] **Step 3: Add the component and table-of-contents entry to each page**

Add this import to each page, next to the other component imports:

```astro
import SessionCodePlayground from "../../components/code-explorer/SessionCodePlayground.astro";
```

Add one table-of-contents link and one component invocation. Use the existing `session.slug`, never a duplicated string literal.

```astro
<li><a href="#code-playground">ブラウザで試す</a></li>
<!-- Place this after the page's prerequisite-reading section. -->
<SessionCodePlayground slug={session.slug} />
```

Use these exact positions to preserve each learning sequence:

| Page | Insert after | Insert before |
| --- | --- | --- |
| `00-break-the-app` | `失敗を再現する` | `レビューと次のセッション` |
| `00-read-the-incident` | `次の編集の準備` | `レビューと振り返り` |
| `01-state-modeling` | `失敗から作成対象を読む` | `状態とデータを同時に閉じる` |
| `02-boundary-and-ids` | `失敗から変換境界を読む` | `入力・ID・PIIを別々に守る` |
| `03-result-errors` | `失敗を値として扱う` | `成功した変更だけを記録する` |
| `04-agent-review` | `エージェントへの依頼を組み立てる` | `人が要求からレビューする` |
| `05-mini-integration` | `既習技法を選び1関数を作成する` | `統合ループで効果を確認する` |
| `final` | `電話フォローとPII保護を確認する` | `完成例を検証する` |

- [ ] **Step 4: Update exact outline contracts**

The existing tests intentionally assert the authored `h2` outline and the matching number of desktop/mobile table-of-contents links. Insert `ブラウザで試す` at the placement above in every affected expected array. For example, update the Session 03 and 04 expectations in `sessions-03-04.test.ts` to these exact values:

```ts
expectAuthoredOutline(parseStaticMarkup(html), [
  "要求と結果の責任を分ける",
  "失敗を値として扱う",
  "ブラウザで試す",
  "成功した変更だけを記録する",
  "レビューと適用範囲を確認する",
]);

expectAuthoredOutline(parseStaticMarkup(html), [
  "依頼とレビューの責任を分ける",
  "エージェントへの依頼を組み立てる",
  "ブラウザで試す",
  "人が要求からレビューする",
  "完了条件と統合演習への橋渡し",
]);
```

Apply the same insertion to both Session 00 outlines, Session 01, Session 02, and Session 05 in their respective existing tests. Do not relax the helpers that require each heading to have exactly one target and each target to appear in both tables of contents.

- [ ] **Step 5: Run the new and existing session-page tests**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/sessions/code-playground.test.ts src/test/pages/sessions/session-00.test.ts src/test/pages/sessions/sessions-01-02.test.ts src/test/pages/sessions/sessions-03-04.test.ts src/test/pages/sessions/session-05.test.ts src/test/pages/sessions/final.test.ts`

Expected: PASS; every page has one load-hydrated Playground for its own slug, two matching table-of-contents links, and its original prose and command contracts.

- [ ] **Step 6: Commit the per-page integration**

```bash
git add apps/docs/src/pages/sessions apps/docs/src/test/pages/sessions
git commit -m "feat(docs): embed playgrounds in sessions"
```

## Task 3: Playwrightでレスポンシブ表示を検証する

**Files:**
- Create: `apps/docs/e2e/session-code-playground.spec.ts`

**Interfaces:**
- Consumes: the eight static routes, `.session-code-playground`, `[data-code-explorer]`, and the existing Playwright `baseURL` at `http://127.0.0.1:4321`.
- Produces: browser-level confirmation that each target page shows usable controls without horizontal overflow at 390px and 1440px widths.

- [ ] **Step 1: Write the responsive browser regression test**

Create the test after Tasks 1 and 2 have supplied the responsive behavior. It must visit all eight routes at both widths; it must not click `実行`, because WebContainer startup is intentionally deferred and belongs to the existing component tests.

```ts
import { expect, test } from "@playwright/test";

const routes = [
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
  "/sessions/01-state-modeling/",
  "/sessions/02-boundary-and-ids/",
  "/sessions/03-result-errors/",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration/",
  "/sessions/final/",
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route} keeps the playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const playground = page.locator(".session-code-playground");
      await expect(playground).toBeVisible();
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toBeVisible();
      const widths = await playground.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
    });
  }
}
```

- [ ] **Step 2: Run the responsive test to establish the intended baseline**

Run: `pnpm --filter @fp-with-ts/docs test:visual -- session-code-playground.spec.ts`

Expected: PASS for 16 route/viewport combinations. Each view displays the file tree, editor actions, and output region inside the viewport. The shared stylesheet must retain the desktop `grid-template-columns: minmax(13rem, 0.32fr) minmax(0, 1fr)`, the mobile single-column rule, the 24rem mobile editor minimum, and the 2.75rem action-button minimum; it must not add a page-level horizontal scroller.

- [ ] **Step 3: Perform the required visual inspection**

Open each of the eight routes at 390px and 1440px. Confirm the visible file names do not force page-wide horizontal scrolling, the code editor is readable, reset/run buttons are tappable, the output panel is below the editor, and the Playground appears after the intended prerequisite section. Do not press `実行` as part of this layout inspection.

- [ ] **Step 4: Run the complete docs and repository verification**

Run these commands separately:

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs typecheck
pnpm --filter @fp-with-ts/docs build
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands pass. The intentional `exercise:*` failures are not part of these normal-health commands.

- [ ] **Step 5: Commit the responsive coverage**

```bash
git add apps/docs/e2e/session-code-playground.spec.ts apps/docs/src/styles/code-playground.css
git commit -m "test(docs): verify session playground layouts"
```

## Plan Self-Review

### Spec coverage

- Eight session pages, their matching snapshots, individual placement, and table-of-contents links are implemented and tested in Task 2.
- Existing Code Explorer behavior, browser-only editing, deferred WebContainer execution, unsupported-browser fallback, fixed command boundary, and the standalone preview are preserved by Task 1 and its existing preview contract test.
- Shared responsive styling, mobile and desktop layout verification, and all eight target URLs are covered by Task 3.
- Docs-specific test, typecheck, build, and whole-repository verification are explicit in Task 3.

### Placeholder scan

The plan contains no deferred requirements or unspecified implementation steps. File paths, public prop, exact component markup, test inputs, test commands, viewport sizes, placement anchors, and commit messages are specified.

### Type consistency

All callers use `SessionCodePlayground` with `slug={session.slug}`. The new component consumes only `sessionWorkspaceFor(slug)` and `projectFilesFor(slug)`, and its tests assert the same `data-code-explorer` slug and initial-file values declared by the existing workspace catalog.
