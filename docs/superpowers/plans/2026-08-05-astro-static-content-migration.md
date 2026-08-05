# Astro Static Content Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #17のModule 00改善を含むドキュメントサイトをAstroの静的ページへ移し、本文をJSON風オブジェクトではなくページ固有のAstroマークアップとして管理する。

**Architecture:** Astroのファイルルーティングでトップページ、404、7つのモジュールページをビルド時にHTML化する。共通化は文書シェル、ケースファイル型レイアウト、コード表示、ナビゲーション用の薄いモジュールカタログに限定し、本文は各 `.astro` ファイルへ直接記述する。Reactはコマンドのコピー操作だけをアイランドとして担当する。

**Tech Stack:** Astro、`@astrojs/react`、React、TypeScript、Vitest、Astro Container API、Playwright、Cloudflare Workers Static Assets、pnpm 9.12.0、Node.js 20以上

## Global Constraints

- 実装の起点はPR #17 `plan-module-00-app-overview` の先端 `f3d1b02` とする。
- リポジトリ直下の `docs/` にあるPRD、設計書、計画書、イベント資料は移行対象にしない。
- トップページのHTML構造、クラス名、文章、CSS、レスポンシブ挙動を維持する。
- モジュール本文をJSON、JSON風TypeScriptオブジェクト、共通のContentBlock unionへ格納しない。
- 一覧と前後ナビゲーションに必要な薄いメタデータだけを `src/modules/catalog.ts` に置く。
- Reactはユーザー操作が必要なアイランドだけに使用し、本文、目次、ナビゲーションはAstroで生成する。
- `/`、`/modules/<slug>/`、末尾スラッシュを維持する。
- `/module-00` と `/module-00/` は `/modules/00-break-the-app/` へ308リダイレクトする。
- Astroは静的生成を使い、Cloudflare adapterとSSRを導入しない。
- Cloudflare Workersの `/healthz` と既存のデプロイコマンドを維持する。
- 各実装変更は、対象のテストが期待どおり失敗することを確認してから行う。

---

### Task 1: Astro・React基盤とモジュールカタログ

**Files:**
- Modify: `apps/docs/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/docs/astro.config.ts`
- Modify: `apps/docs/tsconfig.json`
- Modify: `apps/docs/vitest.config.ts`
- Create: `apps/docs/src/env.d.ts`
- Create: `apps/docs/src/modules/catalog.ts`
- Create: `apps/docs/src/modules/catalog.test.ts`

**Interfaces:**
- Produces: `ModuleSummary`、`modules`、`moduleBySlug(slug)`、`modulePath(module)`、`moduleNeighbors(slug)`
- Produces: Astroの静的出力、React renderer、末尾スラッシュ付きルートのビルド設定
- Consumes: 現在の `apps/docs/src/content/modules.ts` にある7モジュールの順序

- [ ] **Step 1: AstroとReactの依存関係を追加する**

Run:

```bash
pnpm --filter @fp-with-ts/docs add astro @astrojs/react react react-dom
pnpm --filter @fp-with-ts/docs add -D @astrojs/check @playwright/test @types/react @types/react-dom
```

Viteと旧テスト依存は移行完了まで残す。旧SPAが動く基準を途中で失わないため、このTaskでは削除しない。

- [ ] **Step 2: AstroとVitestの設定を追加する**

`apps/docs/astro.config.ts`:

```typescript
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [react()],
  output: "static",
  outDir: "./dist",
  trailingSlash: "always",
});
```

`apps/docs/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`apps/docs/vitest.config.ts`:

```typescript
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "../../worker/**/*.test.ts"],
  },
});
```

`apps/docs/src/env.d.ts`:

```typescript
/// <reference types="astro/client" />
```

`apps/docs/package.json` のscriptsは、移行前トップページをPlaywrightで記録するTask 2までViteのまま維持する。

- [ ] **Step 3: モジュールカタログの失敗するテストを書く**

`apps/docs/src/modules/catalog.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { moduleBySlug, moduleNeighbors, modulePath, modules } from "./catalog";

describe("module catalog", () => {
  it("keeps the seven modules in workshop order", () => {
    expect(modules.map(({ slug }) => slug)).toEqual([
      "00-break-the-app",
      "00-read-the-incident",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-agent-review",
      "05-mini-integration",
    ]);
  });

  it("uses unique slugs and sequence labels", () => {
    expect(new Set(modules.map(({ slug }) => slug)).size).toBe(modules.length);
    expect(new Set(modules.map(({ sequence }) => sequence)).size).toBe(modules.length);
  });

  it("resolves paths and neighbors", () => {
    const module = moduleBySlug("01-state-modeling");
    expect(module).toBeDefined();
    expect(module === undefined ? undefined : modulePath(module)).toBe(
      "/modules/01-state-modeling/",
    );
    expect(moduleNeighbors("01-state-modeling")).toMatchObject({
      previous: { slug: "00-read-the-incident" },
      next: { slug: "02-boundary-and-ids" },
    });
  });
});
```

- [ ] **Step 4: カタログテストが期待どおり失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/modules/catalog.test.ts`

Expected: FAIL because `src/modules/catalog.ts` does not exist.

- [ ] **Step 5: 薄いモジュールカタログを実装する**

`ModuleSummary` は次の形に固定する。`summary` は既存の `caseStudy.context` を移し、本文のセクションや演習内容は入れない。

```typescript
export type ModuleSummary = Readonly<{
  slug: string;
  sequence: "00-A" | "00-B" | "01" | "02" | "03" | "04" | "05";
  label: string;
  title: string;
  durationMinutes: number;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
}>;

export const modules = [
  {
    slug: "00-break-the-app",
    sequence: "00-A",
    label: "DOG",
    title: "導入事故を起こす",
    durationMinutes: 15,
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary: "WAN NYAN CLINIC の予約・カルテシステムで再診対応を扱います。",
  },
  {
    slug: "00-read-the-incident",
    sequence: "00-B",
    label: "CAT",
    title: "事故報告を読む",
    durationMinutes: 15,
    animal: { name: "CAT", type: "cat", avatar: "🐈" },
    summary: "キャンセル後の業務対応に必要な情報を整理します。",
  },
  {
    slug: "01-state-modeling",
    sequence: "01",
    label: "RABBIT",
    title: "状態遷移を型にする",
    durationMinutes: 30,
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "うさぎの予約で、キャンセル後の再診希望を安全に扱います。",
  },
  {
    slug: "02-boundary-and-ids",
    sequence: "02",
    label: "BIRD",
    title: "境界と ID を守る",
    durationMinutes: 25,
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "鳥の外部検査結果と飼い主の連絡先を、安全な境界で扱います。",
  },
  {
    slug: "03-result-errors",
    sequence: "03",
    label: "HAMSTER",
    title: "失敗理由と変更記録を返す",
    durationMinutes: 30,
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "ハムスターの診察開始で、画面に失敗理由を返し成功だけを記録します。",
  },
  {
    slug: "04-agent-review",
    sequence: "04",
    label: "TURTLE",
    title: "エージェントレビューを設計する",
    durationMinutes: 20,
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "カメの電話フォロー対象を、既存の設計判断を保って AI エージェントへ依頼します。",
  },
  {
    slug: "05-mini-integration",
    sequence: "05",
    label: "FOX",
    title: "ミニ総合演習",
    durationMinutes: 15,
    animal: { name: "FOX", type: "fox", avatar: "🦊" },
    summary: "キツネの検査結果から、電話フォローが必要な患者だけを安全に抽出します。",
  },
] as const satisfies readonly ModuleSummary[];

export const moduleBySlug = (slug: string): ModuleSummary | undefined =>
  modules.find((module) => module.slug === slug);

export const modulePath = (module: ModuleSummary): string => `/modules/${module.slug}/`;

export const moduleNeighbors = (
  slug: string,
): Readonly<{ previous?: ModuleSummary; next?: ModuleSummary }> => {
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

- [ ] **Step 6: カタログテストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/modules/catalog.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 7: 基盤をコミットする**

```bash
git add apps/docs/package.json apps/docs/astro.config.ts apps/docs/tsconfig.json apps/docs/vitest.config.ts apps/docs/src/env.d.ts apps/docs/src/modules/catalog.ts apps/docs/src/modules/catalog.test.ts pnpm-lock.yaml
git commit -m "build(docs): add Astro and React foundation"
```

### Task 2: トップページを見た目を変えずAstroへ移す

**Files:**
- Create: `apps/docs/src/layouts/BaseLayout.astro`
- Create: `apps/docs/src/pages/index.astro`
- Create: `apps/docs/src/pages/index.test.ts`
- Create: `apps/docs/playwright.config.ts`
- Create: `apps/docs/e2e/home.spec.ts`
- Create: `apps/docs/e2e/__screenshots__/home-desktop.png`
- Create: `apps/docs/e2e/__screenshots__/home-mobile.png`
- Modify: `apps/docs/package.json`
- Preserve: `apps/docs/src/styles/base.css`
- Read as migration source: `apps/docs/src/pages/home-page.ts`
- Read as migration source: `apps/docs/src/pages/home-page.test.ts`

**Interfaces:**
- Produces: `BaseLayout.astro` with `title` and optional `description` props
- Produces: `/` as a static Astro page
- Preserves: `.home-page.wan-nyan-home` and every descendant class/text from the legacy page

- [ ] **Step 1: 視覚回帰テストを作り、移行前のトップページを記録する**

`apps/docs/playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: { baseURL: "http://127.0.0.1:4321", locale: "ja-JP" },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
  },
});
```

`apps/docs/e2e/home.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test("desktop home keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-desktop.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("mobile home keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-mobile.png", {
    animations: "disabled",
    fullPage: true,
  });
});
```

Run: `pnpm --filter @fp-with-ts/docs exec playwright install chromium`

Run: `pnpm --filter @fp-with-ts/docs exec playwright test --update-snapshots`

Expected: both tests pass against the current Vite page and create the two named PNG baselines. Do not edit `base.css` or `home-page.ts` before this succeeds.

- [ ] **Step 2: Astro版トップページの失敗するテストを書く**

`apps/docs/src/pages/index.test.ts`:

```typescript
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import HomePage from "./index.astro";

describe("home page", () => {
  it("preserves the WAN NYAN landing page structure and content", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomePage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector(".home-page.wan-nyan-home")).not.toBeNull();
    expect(document.querySelector(".landing-header")).not.toBeNull();
    expect(document.querySelector(".system-window")).not.toBeNull();
    expect(document.querySelectorAll(".splat-card")).toHaveLength(7);
    expect(document.querySelectorAll(".time-stop")).toHaveLength(7);
    expect(document.querySelector("h1")?.textContent).toContain("WAN NYAN");
    expect(document.querySelector('a[href="/modules/00-break-the-app/"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: トップページテストが期待どおり失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/index.test.ts`

Expected: FAIL because `src/pages/index.astro` does not exist.

- [ ] **Step 4: 文書シェルを実装する**

`apps/docs/src/layouts/BaseLayout.astro`:

```astro
---
import "../styles/base.css";

interface Props {
  title: string;
  description?: string;
  bodyClass?: string;
}

const { title, description, bodyClass } = Astro.props;
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    {description === undefined ? null : <meta name="description" content={description} />}
    <title>{title}</title>
  </head>
  <body class={bodyClass}>
    <slot />
  </body>
</html>
```

- [ ] **Step 5: 既存トップページの要素ツリーをAstroへ直接移す**

`apps/docs/src/pages/home-page.ts:5` から `apps/docs/src/pages/home-page.ts:117` までの要素ツリーを、文字、属性、クラス、要素順を変えず `BaseLayout` の内側へ移す。既存の `#app` ラッパーも維持する。`index.astro` の文書シェルは次の値に固定する。

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout
  title="FP with TypeScript"
  description="関数型ドメインモデリングをTypeScriptで体験する動物病院ハンズオン"
>
  <div id="app">
    <div class="home-page wan-nyan-home">
```

この直後へ `home-page.ts:5-117` の既存要素を文字どおり置き、`</div></div></BaseLayout>` で閉じる。完成したproduction fileは `landing-footer` までの既存要素をすべて含み、loop、content object、generated sectionを含まない。

After `index.astro` exists, change `apps/docs/package.json` scripts to:

```json
{
  "dev": "astro dev --host 0.0.0.0",
  "build": "astro check && astro build",
  "typecheck": "astro check",
  "test": "vitest run",
  "test:visual": "playwright test",
  "preview": "astro preview --host 0.0.0.0"
}
```

- [ ] **Step 6: トップページテストとスクリーンショット比較を行う**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/index.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/docs test:visual`

Expected: both screenshots match the legacy baselines without updating snapshots. The page geometry, colors, typography, copy, and responsive layout must match. Fix only Astro shell differences; do not redesign the homepage.

- [ ] **Step 7: トップページ移行をコミットする**

```bash
git add apps/docs/src/layouts/BaseLayout.astro apps/docs/src/pages/index.astro apps/docs/src/pages/index.test.ts apps/docs/playwright.config.ts apps/docs/e2e apps/docs/package.json
git commit -m "feat(docs): render the landing page with Astro"
```

### Task 3: ケースファイルレイアウトとReactコピー操作

**Files:**
- Create: `apps/docs/src/components/CodeBlock.astro`
- Create: `apps/docs/src/components/CommandBlock.astro`
- Create: `apps/docs/src/components/CopyButton.tsx`
- Create: `apps/docs/src/components/CopyButton.test.tsx`
- Create: `apps/docs/src/layouts/ModuleLayout.astro`
- Create: `apps/docs/src/layouts/ModuleLayout.test.ts`
- Create: `apps/docs/src/test/render-astro.ts`
- Create: `apps/docs/src/styles/modules.css`

**Interfaces:**
- Consumes: `ModuleSummary` and navigation helpers from Task 1
- Produces: `ModuleLayout` props `{ module: ModuleSummary }` and named slot `toc`
- Produces: `CommandBlock` props `{ phase, command, expected }`
- Produces: `CodeBlock` props `{ code, language?, label? }`
- Produces: `CopyButton` props `{ value: string }`

- [ ] **Step 1: コピー操作の失敗するReactテストを書く**

`apps/docs/src/components/CopyButton.test.tsx`:

```tsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("copies the exact command and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<CopyButton value="pnpm test" />));
    await act(async () => host.querySelector("button")?.click());

    expect(writeText).toHaveBeenCalledWith("pnpm test");
    expect(host.textContent).toContain("コピーしました");
  });

  it("keeps the retry label when clipboard access fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<CopyButton value="pnpm test" />));
    await act(async () => host.querySelector("button")?.click());

    expect(host.textContent).toContain("コピーする");
    expect(host.textContent).not.toContain("コピーしました");
  });
});
```

- [ ] **Step 2: レイアウトの失敗するAstroテストを書く**

`apps/docs/src/test/render-astro.ts`:

```typescript
import { getContainerRenderer as reactContainerRenderer } from "@astrojs/react/container-renderer";
import { loadRenderers } from "astro:container";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

export const createAstroContainer = async (): Promise<AstroContainer> =>
  AstroContainer.create({
    renderers: await loadRenderers([reactContainerRenderer()]),
  });
```

`apps/docs/src/layouts/ModuleLayout.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { modules } from "../modules/catalog";
import { createAstroContainer } from "../test/render-astro";
import ModuleLayout from "./ModuleLayout.astro";

describe("ModuleLayout", () => {
  it("renders the case file hero, authored toc, and module navigation", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ModuleLayout, {
      props: { module: modules[2] },
      slots: {
        toc: '<ol><li><a href="#mission">ミッション</a></li></ol>',
        default: '<section id="mission"><h2>ミッション</h2></section>',
      },
    });

    expect(html).toContain("MODULE 01");
    expect(html).toContain("状態遷移を型にする");
    expect(html).toContain('aria-label="ページ内目次"');
    expect(html).toContain('/modules/00-read-the-incident/');
    expect(html).toContain('/modules/02-boundary-and-ids/');
  });
});
```

- [ ] **Step 3: 新規コンポーネントがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/CopyButton.test.tsx src/layouts/ModuleLayout.test.ts`

Expected: FAIL because `CopyButton.tsx` and `ModuleLayout.astro` do not exist.

- [ ] **Step 4: Reactコピー操作を実装する**

`CopyButton.tsx` は `idle | copied` だけを状態として持つ。失敗時は `idle` のままにする。

```tsx
import { useState } from "react";

export const CopyButton = ({ value }: Readonly<{ value: string }>) => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="copy-button" onClick={copy} aria-live="polite">
      {copied ? "コピーしました" : "コピーする"}
    </button>
  );
};
```

`apps/docs/src/components/CodeBlock.astro`:

```astro
---
interface Props {
  code: string;
  language?: string;
  label?: string;
}

const { code, language = "text", label } = Astro.props;
---

<figure class="code-block">
  {label === undefined ? null : <figcaption>{label}</figcaption>}
  <pre><code class={`language-${language}`}>{code}</code></pre>
</figure>
```

`apps/docs/src/components/CommandBlock.astro`:

```astro
---
import { CopyButton } from "./CopyButton";
import CodeBlock from "./CodeBlock.astro";

interface Props {
  phase: "red" | "green";
  command: string;
  expected: string;
}

const { phase, command, expected } = Astro.props;
---

<section class:list={["command-block", `command-block--${phase}`]} data-phase={phase}>
  <header>
    <h2>{phase === "red" ? "失敗を確認する" : "効果を確認する"}</h2>
    <CopyButton client:idle value={command} />
  </header>
  <CodeBlock code={command} language="shell" />
  <p><strong>期待結果:</strong> {expected}</p>
</section>
```

- [ ] **Step 5: ケースファイルレイアウトを実装する**

`ModuleLayout.astro` は次の責務に限定する。

```astro
---
import BaseLayout from "./BaseLayout.astro";
import { moduleNeighbors, modulePath, type ModuleSummary } from "../modules/catalog";
import "../styles/modules.css";

interface Props {
  module: ModuleSummary;
}

const { module } = Astro.props;
const { previous, next } = moduleNeighbors(module.slug);
---

<BaseLayout title={`${module.title} | FP with TypeScript`} description={module.summary}>
  <div class="case-file">
    <header class="case-file__site-header">
      <a href="/">WAN NYAN CLINIC</a>
    </header>
    <main>
      <section class="case-file__hero" aria-labelledby="module-title">
        <p>MODULE {module.sequence} · {module.durationMinutes}分</p>
        <h1 id="module-title">{module.title}</h1>
        <p>{module.animal.avatar} {module.animal.name}（{module.animal.type}） {module.summary}</p>
      </section>
      <div class="case-file__body">
        <details class="case-file__toc" open>
          <summary>目次</summary>
          <nav aria-label="ページ内目次"><slot name="toc" /></nav>
        </details>
        <article class="case-file__content"><slot /></article>
      </div>
      <nav class="case-file__module-nav" aria-label="前後のモジュール">
        {previous === undefined ? null : <a rel="prev" href={modulePath(previous)}>前へ: {previous.title}</a>}
        {next === undefined ? null : <a rel="next" href={modulePath(next)}>次へ: {next.title}</a>}
      </nav>
    </main>
  </div>
</BaseLayout>
```

`modules.css` ではミント、レモン、コーラルをCSS custom propertiesとして定義し、デスクトップは目次と本文の2列、768px未満は1列で目次を `details/summary` 相当の読み順へ置く。本文幅は約70文字、コマンドは横スクロール可能、focus ringは常に可視とする。

- [ ] **Step 6: コンポーネントとレイアウトのテストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/CopyButton.test.tsx src/layouts/ModuleLayout.test.ts`

Expected: PASS with 4 tests.

- [ ] **Step 7: 共通UIをコミットする**

```bash
git add apps/docs/src/components apps/docs/src/layouts/ModuleLayout.astro apps/docs/src/layouts/ModuleLayout.test.ts apps/docs/src/test/render-astro.ts apps/docs/src/styles/modules.css
git commit -m "feat(docs): add case file module layout"
```

### Task 4: PR #17版Module 00を直接Astroマークアップへ移す

**Files:**
- Create: `apps/docs/src/pages/modules/00-break-the-app.astro`
- Create: `apps/docs/src/pages/modules/00-read-the-incident.astro`
- Create: `apps/docs/src/pages/modules/module-00.test.ts`
- Read as migration source: `apps/docs/src/content/modules/00-break-the-app.ts`
- Read as migration source: `apps/docs/src/content/modules/00-read-the-incident.ts`

**Interfaces:**
- Consumes: `ModuleLayout`, `CommandBlock`, `CodeBlock`, `moduleBySlug`
- Produces: `/modules/00-break-the-app/` and `/modules/00-read-the-incident/`
- Preserves: PR #17のオンボーディング階層とModule 00固有の文章

- [ ] **Step 1: 2ページの失敗するテストを書く**

`module-00.test.ts` で両ページをAstro Containerへ読み込み、次を検証する。

```typescript
import { describe, expect, it } from "vitest";
import { createAstroContainer } from "../../test/render-astro";
import BreakTheAppPage from "./00-break-the-app.astro";
import ReadTheIncidentPage from "./00-read-the-incident.astro";

describe("Module 00 pages", () => {
  it("onboards participants before reproducing the incident", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(BreakTheAppPage, { partial: false });
    expect(html).toContain("開発に参加する前に");
    expect(html).toContain("動物病院の役割");
    expect(html).toContain("1回の来院の流れ");
    expect(html).toContain("登場人物");
    expect(html).toContain("提供する機能と価値");
    expect(html).toContain("来院をモデリングしよう");
    expect(html).toContain("Paid は終端状態");
    expect(html).toContain("exercise:00");
    expect(html).toContain("src/legacy/appointment.ts");
  });

  it("turns the cancellation incident into the next modeling requirement", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ReadTheIncidentPage, { partial: false });
    expect(html).toContain("事故報告を読む");
    expect(html).toContain("Canceled は reason を持ち");
    expect(html).toContain("キャンセル理由");
    expect(html).toContain("exercise:01");
  });
});
```

- [ ] **Step 2: ページがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/module-00.test.ts`

Expected: FAIL because both `.astro` pages do not exist.

- [ ] **Step 3: `00-break-the-app.astro` を実装する**

ページ先頭で `moduleBySlug("00-break-the-app")` を取得し、見つからない場合は例外にする。本文と目次を同じファイルに直接記述する。次の順序で、移行元の全固有文章を意味的HTMLへ移す。

1. 「開発に参加する前に」章
2. 「動物病院の役割」
3. 番号付きの「1回の来院の流れ」
4. `dl` を使う「登場人物」
5. 3列の表を使う「提供する機能と価値」
6. 状態フローを使う「来院をモデリングしよう」
7. 「開発者として今日取り組むこと」
8. 「今回の状況」と「事故報告」
9. Redコマンド、読むファイル、観察項目
10. 技法の理由と限界、完了条件、振り返り、代替進行、次セッション

ページのfrontmatterは次の形にする。

```astro
---
import CommandBlock from "../../components/CommandBlock.astro";
import ModuleLayout from "../../layouts/ModuleLayout.astro";
import { moduleBySlug } from "../../modules/catalog";

const module = moduleBySlug("00-break-the-app");
if (module === undefined) throw new Error("Unknown module: 00-break-the-app");
---
```

`ModuleLayout` のdefault slotへ本文、`toc` slotへ4章の目次を直接記述する。4章は `before-joining`、`incident`、`exercise`、`review` とし、本文には移行元の全paragraph、list row、state、person、value-map row、review point、done condition、reflection question、fallback referenceを含める。page-local content objectは作らない。

- [ ] **Step 4: `00-read-the-incident.astro` を実装する**

移行元から要求、`Canceled` の不変条件、ミッション、`exercise:01`、次に編集する `Appointment` union、振り返り、代替進行を直接マークアップへ移す。目次はページ内で手書きし、本文をオブジェクトへ分離しない。

- [ ] **Step 5: Module 00テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/module-00.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 6: Module 00移行をコミットする**

```bash
git add apps/docs/src/pages/modules/00-break-the-app.astro apps/docs/src/pages/modules/00-read-the-incident.astro apps/docs/src/pages/modules/module-00.test.ts
git commit -m "feat(docs): migrate Module 00 to Astro pages"
```

### Task 5: 状態モデリングと境界モジュールを移す

**Files:**
- Create: `apps/docs/src/pages/modules/01-state-modeling.astro`
- Create: `apps/docs/src/pages/modules/02-boundary-and-ids.astro`
- Create: `apps/docs/src/pages/modules/modules-01-02.test.ts`
- Read as migration source: `apps/docs/src/content/modules/01-state-modeling.ts`
- Read as migration source: `apps/docs/src/content/modules/02-boundary-and-ids.ts`

**Interfaces:**
- Produces: `/modules/01-state-modeling/` and `/modules/02-boundary-and-ids/`
- Consumes: common layout and code/command components

- [ ] **Step 1: モジュール固有要件の失敗するテストを書く**

```typescript
import { describe, expect, it } from "vitest";
import { createAstroContainer } from "../../test/render-astro";
import StateModelingPage from "./01-state-modeling.astro";
import BoundaryPage from "./02-boundary-and-ids.astro";

describe("Modules 01 and 02", () => {
  it("teaches state and data as one discriminated union", async () => {
    const html = await (await createAstroContainer()).renderToString(StateModelingPage);
    expect(html).toContain("Scheduled -&gt; CheckedIn -&gt; InExamination -&gt; Paid");
    expect(html).toContain("Discriminated Union");
    expect(html).toContain("Appointment.startExamination");
    expect(html).toContain("Appointment.cancelWithReason");
    expect(html).toContain("exercise:01");
  });

  it("separates input validation, branded IDs, and PII protection", async () => {
    const html = await (await createAstroContainer()).renderToString(BoundaryPage);
    expect(html).toContain("unknown は parse してから使い");
    expect(html).toContain("Branded Type");
    expect(html).toContain("Sensitive");
    expect(html).toContain("[REDACTED]");
    expect(html).toContain("exercise:02");
  });
});
```

- [ ] **Step 2: 2ページがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/modules-01-02.test.ts`

Expected: FAIL because the module pages do not exist.

- [ ] **Step 3: Module 01を直接マークアップで実装する**

`01-state-modeling.ts` の全固有情報を、次の読み順へ統合する。

1. キャンセル理由と再診希望という要求
2. 許可する状態遷移と終端状態
3. Redの `exercise:01`
4. 読む場所と編集する2関数
5. `Appointment` unionのコード例
6. Discriminated Unionを選ぶ理由と限界
7. Greenの `exercise:01`
8. レビュー観点、完了条件、業務への転用、振り返り、代替進行

Code examples stay literal in the `.astro` file through `CodeBlock`; they are not moved into TypeScript data exports.

- [ ] **Step 4: Module 02を直接マークアップで実装する**

`02-boundary-and-ids.ts` の全固有情報を、外部入力、用途別ID、PIIという3境界が混ざらない構成へ統合する。`exercise:02`、編集対象2関数、`unknown` parse、Branded Type、Sensitive、`[REDACTED]`、技法の限界、振り返り、代替進行を必ず含める。

- [ ] **Step 5: Module 01・02テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/modules-01-02.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 6: Module 01・02移行をコミットする**

```bash
git add apps/docs/src/pages/modules/01-state-modeling.astro apps/docs/src/pages/modules/02-boundary-and-ids.astro apps/docs/src/pages/modules/modules-01-02.test.ts
git commit -m "feat(docs): migrate modeling and boundary modules"
```

### Task 6: Resultとエージェントレビューモジュールを移す

**Files:**
- Create: `apps/docs/src/pages/modules/03-result-errors.astro`
- Create: `apps/docs/src/pages/modules/04-agent-review.astro`
- Create: `apps/docs/src/pages/modules/modules-03-04.test.ts`
- Read as migration source: `apps/docs/src/content/modules/03-result-errors.ts`
- Read as migration source: `apps/docs/src/content/modules/04-agent-review.ts`

**Interfaces:**
- Produces: `/modules/03-result-errors/` and `/modules/04-agent-review/`
- Consumes: common layout and code/command components

- [ ] **Step 1: モジュール固有要件の失敗するテストを書く**

```typescript
import { describe, expect, it } from "vitest";
import { createAstroContainer } from "../../test/render-astro";
import ResultPage from "./03-result-errors.astro";
import AgentReviewPage from "./04-agent-review.astro";

describe("Modules 03 and 04", () => {
  it("separates typed failures from successful domain events", async () => {
    const html = await (await createAstroContainer()).renderToString(ResultPage);
    expect(html).toContain("StartExaminationError");
    expect(html).toContain("ExaminationStarted");
    expect(html).toContain("成功時だけ記録");
    expect(html).toContain("exercise:03");
  });

  it("separates agent instructions from human review", async () => {
    const html = await (await createAstroContainer()).renderToString(AgentReviewPage);
    expect(html).toContain("型とテストで検証できること");
    expect(html).toContain("人が要求から判断すること");
    expect(html).toContain("状態遷移");
    expect(html).toContain("domain event");
    expect(html).toContain("exercise:04");
  });
});
```

- [ ] **Step 2: 2ページがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/modules-03-04.test.ts`

Expected: FAIL because the module pages do not exist.

- [ ] **Step 3: Module 03を直接マークアップで実装する**

`03-result-errors.ts` から、失敗理由を `Result` のkindで返す要求、成功時だけ `ExaminationStarted` を記録する不変条件、`exercise:03`、編集対象、コード例、レビュー観点、業務への転用、振り返り、代替進行を移す。失敗と成功イベントを別セクションにし、同じカードへ混ぜない。

- [ ] **Step 4: Module 04を直接マークアップで実装する**

`04-agent-review.ts` から、依頼文に入れる5観点、型で守る範囲、人が判断する範囲、`exercise:04`、編集対象、レビューchecklist、完了条件、振り返り、代替進行を移す。依頼文とレビュー観点は別々の意味的セクションにする。

- [ ] **Step 5: Module 03・04テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/modules-03-04.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 6: Module 03・04移行をコミットする**

```bash
git add apps/docs/src/pages/modules/03-result-errors.astro apps/docs/src/pages/modules/04-agent-review.astro apps/docs/src/pages/modules/modules-03-04.test.ts
git commit -m "feat(docs): migrate result and agent review modules"
```

### Task 7: ミニ総合演習と終了時の行動計画を移す

**Files:**
- Create: `apps/docs/src/pages/modules/05-mini-integration.astro`
- Create: `apps/docs/src/pages/modules/module-05.test.ts`
- Read as migration source: `apps/docs/src/content/modules/05-mini-integration.ts`

**Interfaces:**
- Produces: `/modules/05-mini-integration/`
- Preserves: PRD-09 and PRD-10の統合ループと2つの行動計画入力

- [ ] **Step 1: 最終モジュールの失敗するテストを書く**

```typescript
import { describe, expect, it } from "vitest";
import { createAstroContainer } from "../../test/render-astro";
import MiniIntegrationPage from "./05-mini-integration.astro";

describe("Module 05", () => {
  it("completes the integration loop and captures the next action", async () => {
    const html = await (await createAstroContainer()).renderToString(MiniIntegrationPage);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(html).toContain("1関数で要求を受け止めます");
    expect(html).toContain("collectFollowUpTargets");
    expect(html).toContain("petId mismatch");
    expect(html).toContain("exercise:05");
    expect(document.querySelector('textarea[name="implementation-location"]')).not.toBeNull();
    expect(document.querySelector('textarea[name="first-action"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: ページがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/module-05.test.ts`

Expected: FAIL because `05-mini-integration.astro` does not exist.

- [ ] **Step 3: Module 05を直接マークアップで実装する**

`05-mini-integration.ts` から、電話フォロー要求、既存設計を崩さない不変条件、1関数だけを編集する制約、`exercise:05`、統合ループ、対象患者・petId mismatch・PII・Result・domain eventの検証、まとめ、振り返り、代替進行を移す。

ページ末尾に次のフォームを置く。送信処理は追加しない。

```astro
<section id="action-plan" class="action-plan">
  <h2>次の行動計画</h2>
  <label for="implementation-location">自分の業務コードで最初に見直す実装箇所を書いてください。</label>
  <textarea id="implementation-location" name="implementation-location"></textarea>
  <label for="first-action">その箇所で最初に試す行動を書いてください。</label>
  <textarea id="first-action" name="first-action"></textarea>
</section>
```

- [ ] **Step 4: Module 05テストを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/modules/module-05.test.ts`

Expected: PASS with 1 test.

- [ ] **Step 5: Module 05移行をコミットする**

```bash
git add apps/docs/src/pages/modules/05-mini-integration.astro apps/docs/src/pages/modules/module-05.test.ts
git commit -m "feat(docs): migrate the mini integration module"
```

### Task 8: 静的ルート、404、本文要件を利用者向け契約として検証する

**Files:**
- Create: `apps/docs/src/pages/404.astro`
- Create: `apps/docs/src/pages/site-contract.test.ts`
- Create: `apps/docs/scripts/verify-static-build.mjs`
- Modify: `apps/docs/package.json`

**Interfaces:**
- Consumes: all Astro pages and `modules` catalog
- Produces: custom `/404.html`
- Produces: build-time verification that every route has an HTML file and every root-relative link resolves

- [ ] **Step 1: ルート集合と404の失敗するテストを書く**

```typescript
import { describe, expect, it } from "vitest";
import { modules } from "../modules/catalog";
import NotFoundPage from "./404.astro";

const pageModules = import.meta.glob("./modules/*.astro", { eager: true });

describe("static site contract", () => {
  it("has one authored page for every catalog module", () => {
    const slugs = Object.keys(pageModules)
      .map((path) => path.split("/").at(-1)?.replace(/\.astro$/, ""))
      .filter((slug): slug is string => slug !== undefined)
      .sort();
    expect(slugs).toEqual(modules.map(({ slug }) => slug).slice().sort());
  });

  it("renders a real not-found page", async () => {
    const { experimental_AstroContainer: AstroContainer } = await import("astro/container");
    const html = await (await AstroContainer.create()).renderToString(NotFoundPage, {
      partial: false,
    });
    expect(html).toContain("ページが見つかりません");
    expect(html).toContain('href="/"');
  });
});
```

- [ ] **Step 2: 404ページがないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/site-contract.test.ts`

Expected: FAIL because `src/pages/404.astro` does not exist.

- [ ] **Step 3: 静的404ページを実装する**

`BaseLayout` を使用し、「ページが見つかりません」、トップページへのリンク、最初のModule 00へのリンクを持つ。旧SPAのpathname表示やクライアントルーターは持ち込まない。

- [ ] **Step 4: ビルド成果物検証スクリプトを実装する**

`verify-static-build.mjs` は次を実行する。

```javascript
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const routes = [
  "index.html",
  "404.html",
  "modules/00-break-the-app/index.html",
  "modules/00-read-the-incident/index.html",
  "modules/01-state-modeling/index.html",
  "modules/02-boundary-and-ids/index.html",
  "modules/03-result-errors/index.html",
  "modules/04-agent-review/index.html",
  "modules/05-mini-integration/index.html",
];

for (const route of routes) await access(new URL(route, dist));

const modulePaths = routes
  .filter((route) => route.startsWith("modules/"))
  .map((route) => `/${route.replace(/index\.html$/, "")}`);
const allowedPaths = new Set(["/", "/module-00/", ...modulePaths]);
const htmlFiles = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(target);
  }
};

await walk(fileURLToPath(dist));

const unresolved = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/\shref=(["'])(.*?)\1/g)) {
    const href = match[2];
    if (
      href === undefined ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }
    const url = new URL(href, "https://static.example.test");
    if (url.origin !== "https://static.example.test") continue;
    if (url.pathname.startsWith("/_astro/")) continue;
    if (!allowedPaths.has(url.pathname)) unresolved.push(`${file}: ${href}`);
  }
}

if (unresolved.length > 0) {
  throw new Error(`Unresolved internal links:\n${unresolved.join("\n")}`);
}
```

Update docs build script:

```json
{
  "build": "astro check && astro build && node scripts/verify-static-build.mjs"
}
```

- [ ] **Step 5: 静的契約テストとビルドを成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- src/pages/site-contract.test.ts`

Expected: PASS with 2 tests.

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: Astro check succeeds, 9 HTML files are found, and internal link verification reports no unresolved route.

- [ ] **Step 6: 静的契約をコミットする**

```bash
git add apps/docs/src/pages/404.astro apps/docs/src/pages/site-contract.test.ts apps/docs/scripts/verify-static-build.mjs apps/docs/package.json
git commit -m "test(docs): verify static routes and not-found page"
```

### Task 9: Cloudflareのヘルスチェックと互換リダイレクトを明示する

**Files:**
- Create: `worker/routes.ts`
- Create: `worker/routes.test.ts`
- Create: `worker/index.test.ts`
- Modify: `worker/index.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: `resolveWorkerRoute(pathname): WorkerRoute`
- Preserves: `GET /healthz` → `200 text/plain ok`
- Produces: `/module-00` and `/module-00/` → `308 /modules/00-break-the-app/`
- Preserves: all other requests delegated to `env.ASSETS.fetch(request)`

- [ ] **Step 1: Workerルーティングの失敗するテストを書く**

`worker/routes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveWorkerRoute } from "./routes";

describe("resolveWorkerRoute", () => {
  it("keeps health checks in the worker", () => {
    expect(resolveWorkerRoute("/healthz")).toEqual({ kind: "health" });
  });

  it.each(["/module-00", "/module-00/"])("redirects the legacy path %s", (pathname) => {
    expect(resolveWorkerRoute(pathname)).toEqual({
      kind: "redirect",
      location: "/modules/00-break-the-app/",
    });
  });

  it("delegates static pages to assets", () => {
    expect(resolveWorkerRoute("/modules/01-state-modeling/")).toEqual({ kind: "asset" });
  });
});
```

`worker/index.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";

const createEnv = () => {
  const fetch = vi.fn(async () => new Response("asset"));
  const env: Env = { ASSETS: { fetch } as unknown as Fetcher };
  return { env, fetch };
};

describe("worker fetch", () => {
  it("returns the health response without calling assets", async () => {
    const { env, fetch } = createEnv();
    const response = await worker.fetch(new Request("https://example.test/healthz"), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("redirects the legacy module path permanently", async () => {
    const { env, fetch } = createEnv();
    const response = await worker.fetch(new Request("https://example.test/module-00/"), env);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://example.test/modules/00-break-the-app/",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("delegates authored pages to static assets", async () => {
    const { env, fetch } = createEnv();
    const request = new Request("https://example.test/modules/01-state-modeling/");
    expect(await (await worker.fetch(request, env)).text()).toBe("asset");
    expect(fetch).toHaveBeenCalledWith(request);
  });
});
```

- [ ] **Step 2: ルート判定がないためテストが失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- ../../worker/routes.test.ts ../../worker/index.test.ts`

Expected: FAIL because `worker/routes.ts` does not exist and `worker/index.ts` does not implement redirects.

- [ ] **Step 3: 純粋なルート判定とWorker応答を実装する**

`worker/routes.ts`:

```typescript
export type WorkerRoute =
  | Readonly<{ kind: "health" }>
  | Readonly<{ kind: "redirect"; location: string }>
  | Readonly<{ kind: "asset" }>;

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };
  if (pathname === "/module-00" || pathname === "/module-00/") {
    return { kind: "redirect", location: "/modules/00-break-the-app/" };
  }
  return { kind: "asset" };
};
```

`worker/index.ts` は判定結果をswitchし、redirectはリクエストoriginを維持したURLへ `Response.redirect(url, 308)` する。assetだけ `env.ASSETS.fetch(request)` へ渡す。

- [ ] **Step 4: Static Assets設定をSSG向けへ変更する**

`wrangler.jsonc` の `assets`:

```jsonc
{
  "directory": "apps/docs/dist",
  "binding": "ASSETS",
  "not_found_handling": "404-page",
  "html_handling": "auto-trailing-slash",
  "run_worker_first": ["/healthz", "/module-00", "/module-00/"]
}
```

- [ ] **Step 5: Workerテストと型検査を成功させる**

Run: `pnpm --filter @fp-with-ts/docs test -- ../../worker/routes.test.ts ../../worker/index.test.ts`

Expected: PASS with 7 cases.

Run: `pnpm exec tsc -p worker/tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 6: Workerルーティングをコミットする**

```bash
git add worker/index.ts worker/index.test.ts worker/routes.ts worker/routes.test.ts wrangler.jsonc
git commit -m "feat(worker): serve Astro routes as static assets"
```

### Task 10: 旧SPA・コンテンツスキーマを削除して全体を検証する

**Files:**
- Delete: `apps/docs/index.html`
- Delete: `apps/docs/vite.config.ts`
- Delete: `apps/docs/src/main.ts`
- Delete: `apps/docs/src/app.ts`
- Delete: `apps/docs/src/app.test.ts`
- Delete: `apps/docs/src/routes.ts`
- Delete: `apps/docs/src/routes.test.ts`
- Delete: `apps/docs/src/pages/home-page.ts`
- Delete: `apps/docs/src/pages/home-page.test.ts`
- Delete: `apps/docs/src/pages/module-page.ts`
- Delete: `apps/docs/src/pages/module-page.test.ts`
- Delete: `apps/docs/src/pages/not-found-page.ts`
- Delete: `apps/docs/src/components/code-block.ts`
- Delete: `apps/docs/src/components/content-block.ts`
- Delete: `apps/docs/src/components/content-block.test.ts`
- Delete: `apps/docs/src/components/module-card.ts`
- Delete: `apps/docs/src/content/home.ts`
- Delete: `apps/docs/src/content/module-content.ts`
- Delete: `apps/docs/src/content/module-content.test.ts`
- Delete: `apps/docs/src/content/modules.ts`
- Delete: `apps/docs/src/content/modules.test.ts`
- Delete: `apps/docs/src/content/modules/00-break-the-app.ts`
- Delete: `apps/docs/src/content/modules/00-read-the-incident.ts`
- Delete: `apps/docs/src/content/modules/00-introduction.test.ts`
- Delete: `apps/docs/src/content/modules/01-state-modeling.ts`
- Delete: `apps/docs/src/content/modules/01-02.test.ts`
- Delete: `apps/docs/src/content/modules/02-boundary-and-ids.ts`
- Delete: `apps/docs/src/content/modules/03-result-errors.ts`
- Delete: `apps/docs/src/content/modules/03-04.test.ts`
- Delete: `apps/docs/src/content/modules/04-agent-review.ts`
- Delete: `apps/docs/src/content/modules/05-mini-integration.ts`
- Delete: `apps/docs/src/prd-coverage.test.ts`
- Modify: `apps/docs/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Removes: legacy DOM renderer, client router, content schema, JSON-like module objects
- Preserves: all public routes and scripts (`dev`, `test`, `typecheck`, `build`, `preview`)
- Leaves: `apps/docs/src/styles/base.css` intact to protect the homepage appearance

- [ ] **Step 1: 新しいAstroテストだけで全要件が緑であることを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/modules/catalog.test.ts src/pages/index.test.ts src/layouts/ModuleLayout.test.ts src/components/CopyButton.test.tsx src/pages/modules/module-00.test.ts src/pages/modules/modules-01-02.test.ts src/pages/modules/modules-03-04.test.ts src/pages/modules/module-05.test.ts src/pages/site-contract.test.ts ../../worker/routes.test.ts ../../worker/index.test.ts`

Expected: PASS. Do not delete a legacy source file until this command is green.

- [ ] **Step 2: 旧ファイルを削除する**

Delete exactly the files listed in this Task using patch-based deletion. Preserve `src/styles/base.css`, the new Astro/React files, and the repository-level `docs/` directory.

- [ ] **Step 3: Vite SPA専用依存を削除する**

Run:

```bash
pnpm --filter @fp-with-ts/docs remove @vitejs/plugin-legacy vite
```

Keep `vitest` and `happy-dom`; the Astro Container and React component tests use them.

- [ ] **Step 4: JSON風本文が残っていないことを検証する**

Run:

```bash
rg "ModuleContent|ContentBlock|assertModuleMeetsPrd|renderModulePage|startApp" apps/docs/src
```

Expected: no matches.

Run:

```bash
rg --files apps/docs/src/pages/modules
```

Expected: seven `.astro` pages and four module-page test files. No TypeScript file in `src/content/modules/` remains.

- [ ] **Step 5: docsアプリのテスト・型検査・ビルドを実行する**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASS with all new catalog, component, page, site-contract, and worker route tests.

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: Astro check reports 0 errors.

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: Astro check and static build pass; `verify-static-build.mjs` confirms all routes and internal links.

- [ ] **Step 6: トップページとモジュールページを目視検証する**

Run: `pnpm --filter @fp-with-ts/docs preview --host 127.0.0.1`

Verify `/` at 1440×1200 and 390×844 against the Task 2 before screenshots. Then verify all seven module pages at both widths:

- no horizontal page overflow;
- desktop table of contents remains visible beside the reading column;
- mobile table of contents precedes the article and can be reached by keyboard;
- commands scroll horizontally without widening the page;
- React copy buttons update only after successful clipboard writes;
- previous/next links follow catalog order.

- [ ] **Step 7: リポジトリ全体を検証する**

Run: `pnpm test`

Expected: docs tests and 11 clinic-example tests pass.

Run: `pnpm typecheck`

Expected: clinic-example, docs, and worker typechecks pass.

Run: `pnpm build`

Expected: clinic-example and Astro docs builds pass.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 8: 削除と最終検証をコミットする**

```bash
git add apps/docs pnpm-lock.yaml
git commit -m "refactor(docs): remove schema-driven SPA content"
```

### Task 11: 完了前の差分監査

**Files:**
- Review: all files changed since `f3d1b02`
- Review: `docs/superpowers/specs/2026-08-05-astro-static-content-migration-design.md`
- Review: `docs/superpowers/plans/2026-08-05-astro-static-content-migration.md`

**Interfaces:**
- Confirms: implementation matches the approved design and does not modify clinic exercise behavior

- [ ] **Step 1: 変更範囲を確認する**

Run: `git diff --stat f3d1b02...HEAD`

Expected: changes are limited to `apps/docs`, `worker`, `wrangler.jsonc`, `pnpm-lock.yaml`, and the approved spec/plan files.

- [ ] **Step 2: 無関係な変更と本文オブジェクトを検索する**

Run: `git diff --name-only f3d1b02...HEAD`

Expected: no file under `packages/clinic-example` is modified.

Run: `rg "blocks:\s*\[|kind:\s*\"(prose|command|file-table|checklist)\"" apps/docs/src`

Expected: no matches in production files.

- [ ] **Step 3: 完了検証を新しい出力で再実行する**

Run: `pnpm test`

Expected: exit 0.

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm build`

Expected: exit 0.

Run: `git status --short --branch`

Expected: clean `migrate-docs-to-astro` worktree.

- [ ] **Step 4: 最終コミットが必要か確認する**

If verification required no edits, do not create an empty commit. If verification revealed a scoped fix, commit only that fix with a Conventional Commit message describing the corrected behavior, then repeat Step 3.
