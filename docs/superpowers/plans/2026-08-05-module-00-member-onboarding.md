# Module 00 Member Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe Module 00 as a developer-member onboarding that explains the product, codebase, and workshop path before the first incident task.

**Architecture:** Extend the module content contract with optional introductory blocks and one structured overview block. Render introductory blocks immediately after the module hero, then keep the existing shared exercise flow unchanged. Populate the new capability only for Module 00 and remove content duplicated by the shared renderer.

**Tech Stack:** TypeScript, Vite, Vitest, DOM APIs, CSS

## Global Constraints

- Preserve the canonical route `/modules/00-break-the-app/` and existing SPA routing.
- Keep `introBlocks` optional so modules 01–05 retain their current content contract.
- Use semantic DOM creation and `textContent`; do not introduce `innerHTML`.
- Describe re-examination only as an out-of-scope workflow; do not invent an unapproved business process.
- Do not add a dedicated visual design until the existing section styles are demonstrably insufficient.

---

### Task 1: Add a structured overview content block

**Files:**
- Modify: `apps/docs/src/content/module-content.ts`
- Modify: `apps/docs/src/components/content-block.ts`
- Modify: `apps/docs/src/components/content-block.test.ts`

**Interfaces:**
- Produces: `ContentBlock` variant `{ kind: "overview"; heading: string; introduction: string; items: readonly { title: string; description: string }[] }`.
- Produces: `renderContentBlock(block: ContentBlock): HTMLElement` support for `overview`.

- [ ] **Step 1: Write the failing renderer test**

Add an `overview` fixture to the existing block-kind test data. Assert the returned element has a section, a level-two heading, the introduction, a semantic list, and every item title and description.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- apps/docs/src/components/content-block.test.ts`

Expected: FAIL because `overview` is not assignable to `ContentBlock` or has no renderer case.

- [ ] **Step 3: Add the minimal content and renderer support**

Add this `ContentBlock` variant and render it with existing DOM helpers:

```ts
{
  kind: "overview",
  heading: "このアプリで扱うこと",
  introduction: "業務の全体像を確認してから、最初の依頼に取り組みます。",
  items: [
    { title: "予約", description: "来院の予定を登録する起点です。" },
  ],
}
```

The renderer must create a `<section>`, `<h2>`, `<p>`, `<ul>`, and `<li>` elements with `document.createElement`, setting content with `textContent`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- apps/docs/src/components/content-block.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/content/module-content.ts apps/docs/src/components/content-block.ts apps/docs/src/components/content-block.test.ts
git commit -m "feat(docs): add overview content block"
```

### Task 2: Add Module 00 onboarding content and remove duplicated instructions

**Files:**
- Modify: `apps/docs/src/content/module-content.ts`
- Modify: `apps/docs/src/content/modules/00-break-the-app.ts`
- Modify: `apps/docs/src/content/modules/00-introduction.test.ts`

**Interfaces:**
- Consumes: `ContentBlock` with the new `overview` variant.
- Produces: `ModuleContent.introBlocks?: readonly ContentBlock[]`.
- Produces: Module 00 introductory sections for product context, lifecycle, and codebase/workshop map.

- [ ] **Step 1: Write failing Module 00 content tests**

Extend `00-introduction.test.ts` to require `breakTheAppModule.introBlocks` and assert its combined text contains:

```ts
"予約", "受付", "診察", "会計", "カルテ",
"scheduled", "checked-in", "in-examination", "paid",
"packages/clinic-example", "src/legacy", "exercises", "src/clinic",
"事故報告", "状態モデリング", "境界とID", "Result", "Agent Review"
```

Also assert the existing `blocks` contain none of the duplicate headings `ミッション`, `Red`, and `読むファイル`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- apps/docs/src/content/modules/00-introduction.test.ts`

Expected: FAIL because `introBlocks` does not exist and duplicate blocks remain.

- [ ] **Step 3: Add the minimal Module 00 onboarding content**

Add optional `introBlocks` to `ModuleContent` and populate Module 00 with three `overview` blocks:

1. `WAN NYAN OS 開発チームへようこそ` — product context and the distinction between the scenario UI and the code edited in this workshop.
2. `来院のライフサイクル` — `scheduled → checked-in → in-examination → paid`, with `paid` described as terminal and reopening a paid visit explicitly out of scope.
3. `コードとワークショップの地図` — roles of `src/legacy`, `exercises`, `test`, and `src/clinic`, followed by the later workshop themes.

Remove the Module 00 `blocks` that repeat shared `mission`, `red`, and `filesToRead` content. Retain the incident scenario, its business impact, observation prompts, and next-session bridge.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- apps/docs/src/content/modules/00-introduction.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/content/module-content.ts apps/docs/src/content/modules/00-break-the-app.ts apps/docs/src/content/modules/00-introduction.test.ts
git commit -m "feat(docs): onboard members in module 00"
```

### Task 3: Render onboarding before the first incident task

**Files:**
- Modify: `apps/docs/src/pages/module-page.ts`
- Modify: `apps/docs/src/pages/module-page.test.ts`

**Interfaces:**
- Consumes: `ModuleContent.introBlocks`.
- Produces: Introductory section elements before the existing trigger/invariant/mission exercise sections and in the existing table of contents.

- [ ] **Step 1: Write the failing page tests**

For Module 00, render the page and assert:

```ts
expect(document.body.textContent).toContain("WAN NYAN OS 開発チームへようこそ");
expect(sectionIds.indexOf("wan-nyan-os-")).toBeLessThan(sectionIds.indexOf("trigger"));
expect(tocLinks).toContain("#wan-nyan-os-");
expect(countHeadings("ミッション")).toBe(1);
expect(countHeadings("Red")).toBe(1);
expect(countHeadings("読むファイル")).toBe(1);
```

Use the existing ID and TOC helpers rather than hard-coding a second TOC implementation. Keep assertions scoped to headings and section order instead of CSS classes.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- apps/docs/src/pages/module-page.test.ts`

Expected: FAIL because Module 00 introductory blocks are not rendered before the trigger.

- [ ] **Step 3: Render `introBlocks` immediately after the hero**

In `renderModulePage`, append `content.introBlocks?.map(renderModuleContentBlock)` before rendering the existing shared exercise sections. Continue building the table of contents after all sections are present so it includes the onboarding sections automatically.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- apps/docs/src/pages/module-page.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/pages/module-page.ts apps/docs/src/pages/module-page.test.ts
git commit -m "feat(docs): show module onboarding before tasks"
```

### Task 4: Verify the complete docs app

**Files:**
- Verify: `apps/docs/src/components/content-block.test.ts`
- Verify: `apps/docs/src/content/modules/00-introduction.test.ts`
- Verify: `apps/docs/src/pages/module-page.test.ts`
- Verify: `apps/docs/src/routes.test.ts`

**Interfaces:**
- Verifies: The route remains canonical, onboarding is accessible in the direct Module 00 route, and the broader docs application remains type-safe and buildable.

- [ ] **Step 1: Run the focused regression suite**

Run: `pnpm test -- apps/docs/src/components/content-block.test.ts apps/docs/src/content/modules/00-introduction.test.ts apps/docs/src/pages/module-page.test.ts apps/docs/src/routes.test.ts`

Expected: PASS with no test failures.

- [ ] **Step 2: Run type checking**

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`

Expected: exit code 0.

- [ ] **Step 4: Build the docs application**

Run: `pnpm build`

Expected: exit code 0.

- [ ] **Step 5: Review the direct route manually**

When a browser surface is available, open `/modules/00-break-the-app/` without first visiting the home page. Confirm the reading order is: member onboarding → first incident task → commands and source files → observation points → next module, and confirm that the route and table-of-contents links are not broken. When a browser surface is unavailable, use the existing Happy DOM direct-route and page tests as the nonvisual fallback to verify the same route and reading-order requirements, and record that visual inspection was unavailable.

- [ ] **Step 6: Commit the plan and implementation**

```bash
git add docs/superpowers/plans/2026-08-05-module-00-member-onboarding.md
git commit -m "docs: plan module 00 member onboarding"
```
