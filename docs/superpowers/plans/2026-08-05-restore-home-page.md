# Restore Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the pre-PR #13 WAN NYAN CLINIC landing experience at `/` without changing module routes or module-page behavior.

**Architecture:** Keep the SPA router and render the restored landing page from `renderHomePage`. Add home-scoped semantic DOM structure and home-scoped CSS that reuses the established color tokens, while every module route continues to use `renderModulePage`.

**Tech Stack:** TypeScript, DOM APIs, Vite, Vitest, happy-dom, CSS.

## Global Constraints

- Restore the former home content and visual hierarchy; do not replace it with a new simplified design.
- Keep `/modules/00-break-the-app/` as the Module 00 link target.
- Preserve existing module-page rendering, route handling, and fragment-link browser behavior.
- Keep the home usable at widths below 700px and respect reduced-motion preferences.
- Do not add external runtime dependencies or CDN scripts.

---

### Task 1: Lock the restored home contract with tests

**Files:**
- Modify: `apps/docs/src/pages/home-page.test.ts`

**Interfaces:**
- Consumes: `renderHomePage(): HTMLElement`
- Produces: Executable DOM contract for the restored landing page.

- [ ] **Step 1: Write the failing test**

Add a test named `元の WAN NYAN CLINIC のヒーローと問題導線を復元する` that asserts all of the following observable behavior:

```ts
const page = renderHomePage();

expect(page.querySelector("h1")?.textContent).toContain("WAN NYAN");
expect(page.querySelector("#system [aria-label=\"動物病院の予約・カルテシステム画面\"]")).not.toBeNull();
expect(page.querySelectorAll("#features .splat-card")).toHaveLength(7);
expect(page.querySelectorAll("#problems .time-stop")).toHaveLength(7);
expect(page.querySelector<HTMLAnchorElement>("a[href=\"/modules/00-break-the-app/\"]"))?.textContent).toContain("Module 00");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fp-with-ts/docs test -- home-page.test.ts`

Expected: FAIL because the simplified home does not contain the restored system, feature, or problem sections.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/pages/home-page.test.ts
git commit -m "test(docs): define restored home contract"
```

### Task 2: Render the recovered landing content

**Files:**
- Modify: `apps/docs/src/pages/home-page.ts`
- Test: `apps/docs/src/pages/home-page.test.ts`

**Interfaces:**
- Consumes: `renderHomePage(): HTMLElement`, `modules` from `../content/modules`
- Produces: A semantic `.home-page` subtree containing `#system`, `#features`, `#problems`, and `#start`.

- [ ] **Step 1: Write the failing test**

Extend the Task 1 test with direct anchor expectations:

```ts
expect(page.querySelector<HTMLAnchorElement>('a[href="#features"]')?.textContent).toBe("FEATURES");
expect(page.querySelector<HTMLAnchorElement>('a[href="#problems"]')?.textContent).toBe("PROBLEMS");
expect(page.querySelector<HTMLAnchorElement>('a[href="/modules/00-break-the-app/"]')).not.toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fp-with-ts/docs test -- home-page.test.ts`

Expected: FAIL because the current header has no feature/problem anchors and the former landing structure is absent.

- [ ] **Step 3: Write minimal implementation**

Replace the generic `renderHero`, audience, event, learning-flow, preparation, cards, and reference sections with focused helpers that produce:

```ts
const renderHomePage = (): HTMLElement => {
  const page = document.createElement("div");
  page.className = "home-page";
  page.append(renderLandingHeader(), renderSystemHero(), renderFeatures(), renderProblems(), renderStartPanel(), renderFooter());
  return page;
};
```

Use semantic `header`, `main`, `section`, `article`, `aside`, `nav`, `table`, and `footer` elements. Give the sections the IDs `system`, `features`, `problems`, and `start`. Use `/modules/00-break-the-app/` for both Module 00 calls to action. Keep decorative emoji `aria-hidden`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fp-with-ts/docs test -- home-page.test.ts`

Expected: PASS with every restored content assertion green.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/pages/home-page.ts apps/docs/src/pages/home-page.test.ts
git commit -m "feat(docs): restore WAN NYAN CLINIC home content"
```

### Task 3: Restore the home visual system responsively

**Files:**
- Modify: `apps/docs/src/styles/base.css`
- Test: `apps/docs/src/pages/home-page.test.ts`

**Interfaces:**
- Consumes: Classes emitted by `renderHomePage`, including `.landing-header`, `.landing-hero`, `.system-window`, `.feature-splats`, `.timeline`, and `.start-panel`.
- Produces: Home-scoped desktop, mobile, and reduced-motion presentation.

- [ ] **Step 1: Write the failing test**

Add a DOM-level test that proves the implementation emits the styling hooks needed by the restored layout:

```ts
const page = renderHomePage();

expect(page.querySelector(".landing-hero .copy-panel")).not.toBeNull();
expect(page.querySelector(".system-window .app-dashboard")).not.toBeNull();
expect(page.querySelector(".feature-splats")).not.toBeNull();
expect(page.querySelector(".timeline")).not.toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fp-with-ts/docs test -- home-page.test.ts`

Expected: FAIL until Task 2 emits all visual-layout hooks.

- [ ] **Step 3: Write minimal implementation**

Append CSS scoped to `.home-page` that restores the cream/paper/blue/mint/pink palette, playful outlined panels, two-column hero, dashboard grid, feature cards, timeline, and Module 00 panel. Add media queries at `1040px` and `700px` that reduce the dashboard to readable columns, change hero and start panel to one column, make feature cards compact, and retain timeline access. Add a reduced-motion override for decorative animation.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fp-with-ts/docs test -- home-page.test.ts`

Expected: PASS while current module-page tests remain green.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/styles/base.css apps/docs/src/pages/home-page.test.ts
git commit -m "style(docs): restore home visual system"
```

### Task 4: Verify the complete application

**Files:**
- Verify: `apps/docs/src/pages/home-page.ts`
- Verify: `apps/docs/src/styles/base.css`
- Verify: `apps/docs/src/pages/home-page.test.ts`

**Interfaces:**
- Consumes: The full docs application and its production build.
- Produces: Evidence that recovery did not regress module routes or build output.

- [ ] **Step 1: Run the docs test suite**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASS with no failed tests.

- [ ] **Step 2: Run type checking**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: exit code 0 and a Vite build artifact.

- [ ] **Step 4: Inspect the changed surface**

Run: `git diff --check` and `git diff -- apps/docs/src/pages/home-page.ts apps/docs/src/pages/home-page.test.ts apps/docs/src/styles/base.css`

Expected: no whitespace errors and only the planned home-page/test/style changes.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/pages/home-page.ts apps/docs/src/pages/home-page.test.ts apps/docs/src/styles/base.css
git commit -m "fix(docs): restore homepage design and content"
```
