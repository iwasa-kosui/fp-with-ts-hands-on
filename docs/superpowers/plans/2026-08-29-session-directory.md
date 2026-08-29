# Session Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** トップページの `START SESSION` CTAから、Session 00〜06とFinal Sessionを選べる一覧ページへ移動できるようにします。

**Architecture:** 各セッションページが公開する `session` メタデータを、`/sessions/` の静的ページがビルド時に読み込みます。共通カタログは作らず、一覧専用CSS、E2E、静的ビルド検証だけを追加します。

**Tech Stack:** Astro 4、TypeScript、Vitest、Playwright、CSS

**Spec:** `docs/superpowers/specs/2026-08-29-session-directory-design.md`

## Global Constraints

- Session 00〜06とFinal Sessionの本文、順序、所要時間、前後ナビゲーションは変更しません。
- セッション情報の正本は各 `apps/docs/src/pages/sessions/*.astro` に残し、共通カタログや重複メタデータを作りません。
- `START SESSION` は画面遷移を行うリンクとして実装し、ボタン風に表示します。
- CTAは幅390pxと1440pxの両方で表示します。
- 一覧は幅390pxで1列、幅1440pxで2列にします。
- 本文ページを対象とする既存の8件契約から `sessions/index.astro` を除外します。
- 実装はテスト失敗を確認してから行います。

## File Structure

- Create: `apps/docs/src/pages/sessions/index.astro` — セッションメタデータを集めて一覧を描画します。
- Create: `apps/docs/src/styles/session-directory.css` — 一覧ページだけのレスポンシブ表示を担当します。
- Create: `apps/docs/e2e/session-directory.spec.ts` — 一覧の順序、リンク、モバイル・デスクトップ表示を検証します。
- Create: `apps/docs/e2e/__screenshots__/session-directory-mobile.png` — 幅390pxの承認済み表示です。
- Create: `apps/docs/e2e/__screenshots__/session-directory-desktop.png` — 幅1440pxの承認済み表示です。
- Modify: `apps/docs/src/pages/index.astro` — ヘッダーのCTA文言と遷移先を変更します。
- Modify: `apps/docs/src/styles/base.css` — CTAの強調表示とモバイル表示を追加します。
- Modify: `apps/docs/e2e/home.spec.ts` — CTAの遷移と既存トップページの表示を検証します。
- Modify: `apps/docs/e2e/__screenshots__/home-mobile.png` — モバイルで表示されるCTAを反映します。
- Modify: `apps/docs/e2e/__screenshots__/home-desktop.png` — デスクトップのCTAを反映します。
- Modify: `apps/docs/src/session-contracts.test.ts` — セッション本文ページのglobから一覧を除外します。
- Modify: `apps/docs/src/session-pages.test.ts` — ページ所有契約のglobから一覧を除外します。
- Modify: `apps/docs/scripts/verify-static-build.mjs` — `/sessions/` の出力と内部リンクを検証します。

---

### Task 1: セッション一覧ページ

**Files:**
- Create: `apps/docs/src/pages/sessions/index.astro`
- Create: `apps/docs/src/styles/session-directory.css`
- Create: `apps/docs/e2e/session-directory.spec.ts`
- Modify: `apps/docs/src/session-contracts.test.ts:8-18`
- Modify: `apps/docs/src/session-pages.test.ts:13-23`
- Modify: `apps/docs/scripts/verify-static-build.mjs:5-20`

**Interfaces:**
- Consumes: 各セッションページの `export const session: SessionSummary`
- Produces: GET `/sessions/`、各カードの `href="/sessions/{slug}/"`、`aria-label="セッション一覧"` の順序付きリスト

- [ ] **Step 1: 一覧の失敗するE2Eを書く**

`apps/docs/e2e/session-directory.spec.ts` を次の内容で作成します。

```ts
import { expect, test } from "@playwright/test";

const expectedSessions = [
  { title: "業務とシステムを引き継ぐ", href: "/sessions/00-system-handover/" },
  { title: "ビジネスイベントからワークフローを描く", href: "/sessions/01-business-events-and-workflows/" },
  { title: "予約の状態と遷移をモデル化する", href: "/sessions/02-state-transitions/" },
  { title: "用途の異なる識別子を型で区別する", href: "/sessions/03-semantic-identifiers/" },
  { title: "外部入力を境界で検証し個人情報を守る", href: "/sessions/04-boundaries-and-pii/" },
  { title: "失敗をワークフローの結果として扱う", href: "/sessions/05-workflow-errors/" },
  { title: "副作用と整合性境界を設計する", href: "/sessions/06-effects-and-consistency/" },
  { title: "参照実装で境界をたどる", href: "/sessions/final/" },
] as const;

test("session directory lists every session in curriculum order", async ({ page }) => {
  await page.goto("/sessions/");

  await expect(page.getByRole("heading", { level: 1, name: "セッション一覧" })).toBeVisible();
  const items = page.getByRole("list", { name: "セッション一覧" }).getByRole("listitem");
  await expect(items).toHaveCount(expectedSessions.length);

  for (const [index, expected] of expectedSessions.entries()) {
    const link = items.nth(index).getByRole("link");
    await expect(link).toHaveAttribute("href", expected.href);
    await expect(link.getByRole("heading", { name: expected.title })).toBeVisible();
  }
});
```

- [ ] **Step 2: E2Eが一覧ページ未実装で失敗することを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-directory.spec.ts
```

Expected: FAIL。`/sessions/` が404となり、`セッション一覧` 見出しが見つかりません。

- [ ] **Step 3: ページ所有メタデータから一覧を描画する**

`apps/docs/src/pages/sessions/index.astro` を作成します。globの否定パターンで自身を除外し、slug順で8件を並べます。

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import type { SessionSummary } from "../../sessions/types";
import "../../styles/sessions.css";
import "../../styles/session-directory.css";

const sessions = Object.values(
  import.meta.glob<SessionSummary>(["./*.astro", "!./index.astro"], {
    eager: true,
    import: "session",
  }),
).sort((left, right) => {
  const order = (session: SessionSummary) =>
    session.sequence === "Final"
      ? Number.POSITIVE_INFINITY
      : Number(session.sequence);
  return order(left) - order(right);
});
---

<BaseLayout
  title="セッション一覧 | FP with TypeScript"
  description="関数型ドメインモデリングをTypeScriptで学ぶ全セッションの一覧"
>
  <div class="case-file session-directory">
    <header class="case-file__site-header">
      <a href="/">WAN NYAN CLINIC</a>
    </header>
    <main class="session-directory__main">
      <header class="session-directory__hero">
        <p class="case-file__eyebrow">CURRICULUM</p>
        <h1>セッション一覧</h1>
        <p>Session 00から順番に、動物病院の業務とコードを確認していきます。</p>
      </header>
      <ol class="session-directory__list" aria-label="セッション一覧">
        {sessions.map((session) => (
          <li>
            <a class="session-directory__card" href={`/sessions/${session.slug}/`}>
              <span class="session-directory__meta">
                <span>SESSION {session.sequence.toUpperCase()}</span>
                <span>{session.durationMinutes}分</span>
              </span>
              <span class="session-directory__animal" aria-hidden="true">{session.animal.avatar}</span>
              <h2>{session.title}</h2>
              <p>{session.summary}</p>
              <span class="session-directory__open">セッションを開く</span>
            </a>
          </li>
        ))}
      </ol>
    </main>
  </div>
</BaseLayout>
```

`apps/docs/src/styles/session-directory.css` を作成します。

```css
.session-directory__main {
  width: min(100% - 2rem, 74rem);
  margin-inline: auto;
  padding-block: clamp(2.5rem, 7vw, 5rem);
}

.session-directory__hero {
  max-width: 48rem;
  margin-bottom: 2.5rem;
}

.session-directory__hero h1 {
  margin: 0;
  font-size: clamp(2.25rem, 7vw, 4.5rem);
  line-height: 1.1;
}

.session-directory__hero > p:last-child {
  margin: 1.25rem 0 0;
  font-size: 1.1rem;
  line-height: 1.8;
}

.session-directory__list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-directory__card {
  display: grid;
  height: 100%;
  padding: 1.5rem;
  border: 2px solid var(--case-line);
  background: var(--case-paper);
  box-shadow: 0.4rem 0.4rem 0 var(--case-mint);
  color: var(--case-ink);
  text-decoration: none;
  transition: translate 150ms ease, box-shadow 150ms ease;
}

.session-directory__card:hover,
.session-directory__card:focus-visible {
  box-shadow: 0.65rem 0.65rem 0 var(--case-coral);
  outline: 3px solid var(--case-line);
  outline-offset: 3px;
  translate: -0.2rem -0.2rem;
}

.session-directory__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.session-directory__animal {
  margin-top: 1.5rem;
  font-size: 2.5rem;
}

.session-directory__card h2 {
  margin: 0.5rem 0 0;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  line-height: 1.3;
}

.session-directory__card p {
  margin: 0.75rem 0 1.5rem;
  line-height: 1.7;
}

.session-directory__open {
  align-self: end;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

@media (min-width: 48rem) {
  .session-directory__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-directory__card {
    transition: none;
  }
}
```

- [ ] **Step 4: 一覧E2Eが通ることを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-directory.spec.ts
```

Expected: PASS、1 test passed。

- [ ] **Step 5: 既存のページ所有テストが一覧を本文ページとして誤認することを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs test
```

Expected: FAIL。`index.astro` がglobに加わり、セッション数または `session` の存在検証が失敗します。

- [ ] **Step 6: 本文ページのglobから一覧を除外する**

`apps/docs/src/session-contracts.test.ts` と `apps/docs/src/session-pages.test.ts` の両方で、モジュール用とraw source用のglobを次の配列パターンへ変更します。

```ts
const sessionPagePatterns = [
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
];

const pageModules = import.meta.glob<PageModule>(sessionPagePatterns, {
  eager: true,
});
const pageSources = import.meta.glob<string>(sessionPagePatterns, {
  eager: true,
  query: "?raw",
  import: "default",
});
```

- [ ] **Step 7: ページ所有テストが再び通ることを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs test
```

Expected: PASS、14 test filesと131 tests以上が成功します。

- [ ] **Step 8: 静的ビルド検証が一覧の出力形式を誤認することを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs build
```

Expected: FAIL。`sessions/index/index.html` がないと報告されます。

- [ ] **Step 9: 一覧と本文ページを静的ビルド検証で分ける**

`apps/docs/scripts/verify-static-build.mjs` で `index.astro` をslug一覧から除外し、一覧の出力を明示します。

```js
const sessionSlugs = sessionPages
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".astro") &&
      entry.name !== "index.astro",
  )
  .map((entry) => entry.name.replace(/\.astro$/, ""));

const requiredHtmlFiles = [
  "index.html",
  "404.html",
  "sessions/index.html",
  ...sessionSlugs.map((slug) => `sessions/${slug}/index.html`),
];
```

`sessionPaths` の既存処理から `/sessions/` が生成されるため、`allowedPaths` には個別追加しません。

- [ ] **Step 10: 一覧を含む静的ビルドが通ることを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs build
```

Expected: PASS。`11 page(s) built` と `Verified 11 HTML files and 11 allowed internal routes.` が表示されます。

- [ ] **Step 11: 一覧ページをコミットする**

```bash
git add apps/docs/e2e/session-directory.spec.ts apps/docs/src/pages/sessions/index.astro apps/docs/src/styles/session-directory.css apps/docs/src/session-contracts.test.ts apps/docs/src/session-pages.test.ts apps/docs/scripts/verify-static-build.mjs
git commit -m "feat(sessions): カリキュラム一覧ページを追加" -m "各セッションページが所有するメタデータをビルド時に集め、内容を重複させずに全体から開始位置を選べるようにする。" -m "Co-Authored-By: Codex <noreply@openai.com>"
```

### Task 2: トップページの開始CTA

**Files:**
- Modify: `apps/docs/e2e/home.spec.ts`
- Modify: `apps/docs/src/pages/index.astro:24`
- Modify: `apps/docs/src/styles/base.css:621-646,901-904`

**Interfaces:**
- Consumes: Task 1が提供するGET `/sessions/`
- Produces: accessible name `START SESSION`、`href="/sessions/"` のヘッダーリンク

- [ ] **Step 1: CTAの失敗するE2Eを書く**

`apps/docs/e2e/home.spec.ts` に追加します。

```ts
test("home START SESSION CTA opens the session directory", async ({ page }) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: "START SESSION" });
  await expect(cta).toHaveAttribute("href", "/sessions/");
  await cta.click();

  await expect(page).toHaveURL(/\/sessions\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "セッション一覧" })).toBeVisible();
});
```

- [ ] **Step 2: CTA未実装で失敗することを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/home.spec.ts --grep "START SESSION"
```

Expected: FAIL。`START SESSION` というリンクが見つかりません。

- [ ] **Step 3: ヘッダーリンクをCTAへ変更する**

`apps/docs/src/pages/index.astro` の最後のナビゲーションリンクを変更します。

```astro
<a class="landing-nav__start" href="/sessions/">START SESSION</a>
```

`apps/docs/src/styles/base.css` の既存 `.landing-nav a` 規則の後へ追加します。

```css
.wan-nyan-home .landing-nav a.landing-nav__start {
  border-color: var(--landing-ink);
  background: var(--landing-blue);
  color: #fff;
  white-space: nowrap;
}
```

幅43.75rem以下の既存メディアクエリでは、`.landing-nav { display: none; }` を次へ置き換えます。

```css
.wan-nyan-home .landing-nav { display: flex; }
.wan-nyan-home .landing-nav a:not(.landing-nav__start) { display: none; }
```

- [ ] **Step 4: CTAの遷移テストが通ることを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/home.spec.ts --grep "START SESSION"
```

Expected: PASS、1 test passed。

- [ ] **Step 5: CTAをコミットする**

```bash
git add apps/docs/e2e/home.spec.ts apps/docs/src/pages/index.astro apps/docs/src/styles/base.css
git commit -m "feat(home): セッション一覧への開始CTAを追加" -m "カリキュラム全体を確認してから開始位置を選べるよう、主要導線を一覧ページへ向ける。" -m "Co-Authored-By: Codex <noreply@openai.com>"
```

### Task 3: モバイル・デスクトップの視覚回帰

**Files:**
- Modify: `apps/docs/e2e/session-directory.spec.ts`
- Modify: `apps/docs/e2e/__screenshots__/home-mobile.png`
- Modify: `apps/docs/e2e/__screenshots__/home-desktop.png`
- Create: `apps/docs/e2e/__screenshots__/session-directory-mobile.png`
- Create: `apps/docs/e2e/__screenshots__/session-directory-desktop.png`

**Interfaces:**
- Consumes: Task 1の一覧ページとTask 2のCTA
- Produces: 幅390pxと1440pxの承認済みスクリーンショット4件

- [ ] **Step 1: 一覧ページの失敗する視覚テストを書く**

`apps/docs/e2e/session-directory.spec.ts` に追加します。

```ts
test("desktop session directory keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/");
  await expect(page).toHaveScreenshot("session-directory-desktop.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("mobile session directory keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sessions/");
  await expect(page).toHaveScreenshot("session-directory-mobile.png", {
    animations: "disabled",
    fullPage: true,
  });
});
```

- [ ] **Step 2: 一覧のベースラインがないため失敗することを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-directory.spec.ts --grep "approved appearance"
```

Expected: FAIL。2件ともsnapshotが存在しないと報告されます。

- [ ] **Step 3: トップと一覧の4件のスナップショットを更新する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec playwright test e2e/home.spec.ts e2e/session-directory.spec.ts --update-snapshots
```

Expected: PASS。既存トップ2件が更新され、一覧2件が作成されます。

- [ ] **Step 4: 4件の画像を目視確認する**

画像表示ツールで次を原寸確認します。

- `apps/docs/e2e/__screenshots__/home-mobile.png`: ヘッダー内に `START SESSION` が収まり、本文に横スクロールがない。
- `apps/docs/e2e/__screenshots__/home-desktop.png`: CTAだけが青い主要導線になり、既存ナビゲーションと重ならない。
- `apps/docs/e2e/__screenshots__/session-directory-mobile.png`: 8件が1列で番号順に並び、カード内テキストが切れない。
- `apps/docs/e2e/__screenshots__/session-directory-desktop.png`: 8件が2列4段で並び、左右カードの高さと余白が不自然に崩れない。

- [ ] **Step 5: 全検証を新しく実行する**

Run:

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs build
pnpm --filter @fp-with-ts/docs test:visual
git diff --check
```

Expected:

- Vitest: 14 test files、131 tests以上が成功します。
- Build: 11 page(s)と11 routesの検証が成功します。
- Playwright: トップ5件以上、一覧3件の全テストが成功します。
- `git diff --check`: 出力なし、exit 0です。

- [ ] **Step 6: 視覚回帰をコミットする**

```bash
git add apps/docs/e2e/session-directory.spec.ts apps/docs/e2e/__screenshots__/home-mobile.png apps/docs/e2e/__screenshots__/home-desktop.png apps/docs/e2e/__screenshots__/session-directory-mobile.png apps/docs/e2e/__screenshots__/session-directory-desktop.png
git commit -m "test(docs): セッション開始導線の表示を固定" -m "モバイルとデスクトップでCTAと一覧の配置崩れを検知できるよう、承認済み表示を視覚回帰に追加する。" -m "Co-Authored-By: Codex <noreply@openai.com>"
```

### Task 4: 受け入れ確認とDraft PR

**Files:**
- Verify: `docs/superpowers/specs/2026-08-29-session-directory-design.md`
- Verify: `docs/superpowers/plans/2026-08-29-session-directory.md`

**Interfaces:**
- Consumes: Task 1〜3のコミットと検証結果
- Produces: push済みブランチとDraft PR

- [ ] **Step 1: 変更と受け入れ条件を確認する**

```bash
git status --short --branch
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Expected: 未コミット変更なし。設計、計画、一覧、CTA、視覚回帰のコミットだけが表示されます。

- [ ] **Step 2: ブランチをpushする**

```bash
git push -u origin codex/fix-home-start-session-link
```

- [ ] **Step 3: 既存PRとテンプレートを確認する**

```bash
gh pr view --json number,title,body,url
rg --files .github | rg -i 'pull_request_template'
```

Expected: 既存PRなし。テンプレートが見つかった場合はその構造を維持します。

- [ ] **Step 4: Draft PRを作成する**

PR title:

```text
feat(sessions): セッション一覧と開始導線を追加
```

PR body:

```markdown
## 背景

トップページからSession 00へ直接遷移するため、参加者がカリキュラム全体を確認したり途中から再開したりする入口がありませんでした。

## 内容

各セッションページが所有するメタデータをビルド時に集める方針で、Session 00〜06とFinal Sessionの一覧を追加します。トップページの主要導線は一覧へ向け、モバイルでも表示します。

## Test Plan

- [x] `pnpm --filter @fp-with-ts/docs test`
- [x] `pnpm --filter @fp-with-ts/docs build`
- [x] `pnpm --filter @fp-with-ts/docs test:visual`
- [x] トップページと一覧ページを幅390px、1440pxで目視確認

---
Generated with Codex
```

本文を一時ファイルへ保存し、次を実行します。

```bash
gh pr create --draft --title "feat(sessions): セッション一覧と開始導線を追加" --body-file /tmp/fp-with-ts-session-directory-pr.md
```

- [ ] **Step 5: Draft状態とURLを確認する**

```bash
gh pr view --json isDraft,title,url
```

Expected: `isDraft: true`、タイトル一致、PR URL取得。
