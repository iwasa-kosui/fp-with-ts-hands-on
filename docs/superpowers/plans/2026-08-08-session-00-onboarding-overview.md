# Session 00 Onboarding Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session 00 を、退職した先人のコードを引き継ぐ新任エンジニアが、動物病院の業務・アプリケーション・5つの設計課題を理解する30分のオンボーディングへ変更する。

**Architecture:** 既存 `CodeExplorer` に任意の読み取り専用ガイドを追加し、既存 `monaco-editor` の decoration と SSR `<pre>` の行クラスで同じ範囲を強調する。Session 00 専用の課題定義をデータとして分離し、`00-B` を廃止して `/sessions/00-onboarding/` に統合する。互換 URL は worker で恒久転送し、Session 01 以降の実行可能な Code Explorer は変更しない。

**Tech Stack:** Astro 4、React 18、TypeScript 5、Monaco Editor 0.56、Vitest、Cloudflare Workers

## Global Constraints

- 表示タイトルは正確に「オンボーディング: 退職した先人のコードを引き継ぐ」とする。
- Session 00 のシーケンス表示は `00`、所要時間は30分、正規 URL は `/sessions/00-onboarding/` とする。
- Session 00 に事故報告、事故再現、失敗するテスト、`pnpm exercise:00` を表示しない。
- `examples/session-00` の legacy 実装と演習テストは変更しない。
- Session 00 ではコードを編集・実行せず、5つの設計課題を理解するだけに留める。
- `modern-monaco` と Shiki は導入せず、`monaco-editor` 0.56.0 を維持する。
- Session 01 以降の編集、実行、リセット、出力表示を変えない。
- 旧 `/sessions/00-break-the-app/`、`/sessions/00-read-the-incident/`、`/module-00` は `/sessions/00-onboarding/` へ308リダイレクトする。
- 相対 import の `.js` suffix、Readonly なデータ、既存 Astro/React コンポーネント境界を維持する。
- 新しい画像素材、SVG、外部 CDN、外部 API は追加しない。

---

## File Structure

### 新規ファイル

- `apps/docs/src/code-explorer/code-guide.ts` — ガイド項目と行範囲の共有型。
- `apps/docs/src/code-explorer/onboarding-guides.ts` — Session 00 の5つの設計課題。
- `apps/docs/src/code-explorer/onboarding-guides.test.ts` — 課題と実 source の対応検証。
- `apps/docs/src/components/code-explorer/SessionCodeOverview.astro` — Session 00 専用の読み取りビュー。
- `apps/docs/src/components/code-explorer/SessionCodeOverview.test.ts` — Astro wrapper の構造検証。
- `apps/docs/src/pages/sessions/00-onboarding.astro` — 統合後の Session 00 ページ。

### 変更する共有ファイル

- `apps/docs/src/components/code-explorer/CodeExplorer.tsx` — 任意のガイド表示と読み取り専用分岐。
- `apps/docs/src/components/code-explorer/MonacoEditor.tsx` — 読み取り専用、行 decoration、SSR 行強調。
- `apps/docs/src/styles/code-playground.css` — 課題カードと強調行の表示。
- `apps/docs/src/styles/sessions.css` — 冒頭の吹き出し。
- `apps/docs/src/sessions/catalog.ts` — Session 00 の統合。
- `apps/docs/src/code-explorer/session-workspaces.ts` — 新 slug と source 中心の表示ファイル。
- `worker/routes.ts` — 3つの旧 URL の互換リダイレクト。
- `apps/docs/src/pages/index.astro`、`docs/event/facilitator-guide.md` — 参加者導線と当日進行の同期。

### 削除するファイル

- `apps/docs/src/pages/sessions/00-break-the-app.astro`
- `apps/docs/src/pages/sessions/00-read-the-incident.astro`

---

### Task 1: 既存 Code Explorer に読み取り専用ガイドを追加する

**Files:**
- Create: `apps/docs/src/code-explorer/code-guide.ts`
- Modify: `apps/docs/src/components/code-explorer/CodeExplorer.tsx:14-29,49-230`
- Modify: `apps/docs/src/components/code-explorer/MonacoEditor.tsx:7-18,93-200`
- Modify: `apps/docs/src/styles/code-playground.css`
- Test: `apps/docs/src/components/code-explorer/CodeExplorer.test.tsx`
- Test: `apps/docs/src/components/code-explorer/MonacoEditor.test.tsx`

**Interfaces:**
- Consumes: 既存 `SessionWorkspace`、`ProjectFiles`、`CodeRunner`、`MonacoEditor`。
- Produces:

```ts
export type CodeHighlight = Readonly<{
  startLineNumber: number;
  endLineNumber: number;
}>;

export type CodeGuide = Readonly<{
  id: string;
  title: string;
  currentDesign: string;
  futureRisk: string;
  path: string;
  highlights: readonly CodeHighlight[];
}>;

export type EditorProps = Readonly<{
  path: string;
  value: string;
  files: ProjectFiles;
  typeFiles: ProjectFiles;
  disabled: boolean;
  readOnly: boolean;
  highlights: readonly CodeHighlight[];
  onChange: (value: string) => void;
}>;

export type CodeExplorerProps = Readonly<{
  workspace: SessionWorkspace;
  projectFiles: ProjectFiles;
  guides?: readonly CodeGuide[];
  Editor?: ComponentType<EditorProps>;
  runnerFactory?: () => CodeRunner;
  supportsRuntime?: () => boolean;
}>;
```

- [ ] **Step 1: ガイドモードの失敗テストを書く**

`CodeExplorer.test.tsx` の `TestEditor` に `readOnly` と `highlights` を反映し、次のテストを追加する。

```tsx
const TestEditor: ComponentType<EditorProps> = ({
  path,
  value,
  typeFiles,
  disabled,
  readOnly,
  highlights,
  onChange,
}) => (
  <textarea
    aria-label="コードエディタ"
    data-path={path}
    data-highlights={highlights
      .map(({ startLineNumber, endLineNumber }) =>
        `${startLineNumber}:${endLineNumber}`,
      )
      .join(",")}
    data-type-file={typeFiles["file:///node_modules/vitest/index.d.ts"]}
    value={value}
    disabled={disabled}
    readOnly={readOnly}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const guides = [
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と newStatus は string です。",
    futureRisk: "許可する状態と遷移を型から判断できません。",
    path: "src/example.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
  },
  {
    id: "throw-error",
    title: "予期可能な失敗を throw している",
    currentDesign: "見つからない場合に例外を送出します。",
    futureRisk: "呼び出し側が失敗の種類を型から判断できません。",
    path: "exercises/example.test.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
  },
] as const satisfies readonly CodeGuide[];

it("uses guides to open highlighted source without mutable controls", async () => {
  const runnerFactory = vi.fn<() => CodeRunner>();
  const host = await renderExplorer({ guides, runnerFactory });

  const first = host.querySelector<HTMLButtonElement>(
    '[data-code-guide="string-status"]',
  )!;
  const second = host.querySelector<HTMLButtonElement>(
    '[data-code-guide="throw-error"]',
  )!;

  expect(first.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector("textarea")?.readOnly).toBe(true);
  expect(host.querySelector("textarea")?.dataset.path).toBe("src/example.ts");
  expect(host.querySelector("textarea")?.dataset.highlights).toBe("1:1");
  expect(host.querySelector('[data-action="reset"]')).toBeNull();
  expect(host.querySelector('[data-action="run"]')).toBeNull();
  expect(host.querySelector('[aria-label="実行結果"]')).toBeNull();

  await act(async () => second.click());

  expect(second.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector("textarea")?.dataset.path).toBe(
    "exercises/example.test.ts",
  );
  expect(host.textContent).toContain("呼び出し側が失敗の種類を型から判断できません。");
  expect(runnerFactory).not.toHaveBeenCalled();
});
```

`MonacoEditor.test.tsx` の既存呼び出しへ `readOnly={false}` と `highlights={[]}` を追加し、SSR 強調テストを追加する。

```tsx
it("marks highlighted fallback lines before browser hydration", () => {
  const html = renderToString(
    <MonacoEditor
      path="src/example.ts"
      value={'const safe = true;\nconst status: string = "scheduled";'}
      files={{
        "src/example.ts":
          'const safe = true;\nconst status: string = "scheduled";',
      }}
      typeFiles={{}}
      disabled={false}
      readOnly={true}
      highlights={[{ startLineNumber: 2, endLineNumber: 2 }]}
      onChange={() => undefined}
    />,
  );

  expect(html).toContain('data-line="2"');
  expect(html).toContain("code-explorer__source-line--highlighted");
  expect(html).toContain("const status: string");
});
```

- [ ] **Step 2: 対象テストを実行して RED を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/CodeExplorer.test.tsx src/components/code-explorer/MonacoEditor.test.tsx
```

Expected: `CodeGuide` が存在せず、`EditorProps` に `readOnly` と `highlights` がないため型エラーまたは assertion failure で失敗する。

- [ ] **Step 3: 共有型とガイド分岐を実装する**

`code-guide.ts` に Interfaces の2型を定義する。`CodeExplorer.tsx` では先頭ガイドを初期選択し、ガイド選択時に path と説明を同期する。

```tsx
const [selectedGuideId, setSelectedGuideId] = useState(
  guides?.[0]?.id,
);
const selectedGuide = guides?.find(({ id }) => id === selectedGuideId);
const isGuided = selectedGuide !== undefined;
const [selectedPath, setSelectedPath] = useState(
  selectedGuide?.path ?? workspace.initialFile,
);

const selectGuide = (guide: CodeGuide) => {
  setSelectedGuideId(guide.id);
  setSelectedPath(guide.path);
};
```

ガイドありの場合は `FileTree` の代わりに次の一覧を表示する。

```tsx
<ol className="code-explorer__guides" aria-label="設計課題">
  {guides.map((guide, index) => (
    <li key={guide.id}>
      <button
        type="button"
        data-code-guide={guide.id}
        aria-pressed={guide.id === selectedGuideId}
        onClick={() => selectGuide(guide)}
      >
        <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span>{guide.title}</span>
      </button>
    </li>
  ))}
</ol>
```

エディタ直前に選択中の `currentDesign` と `futureRisk` を表示し、`Editor` へ次を渡す。

```tsx
<div className="code-explorer__guide-detail" aria-live="polite">
  <p><strong>現在の設計:</strong> {selectedGuide?.currentDesign}</p>
  <p><strong>将来困り得ること:</strong> {selectedGuide?.futureRisk}</p>
</div>
<Editor
  path={selectedPath}
  value={contents[selectedPath] ?? ""}
  files={contents}
  typeFiles={typeFiles}
  disabled={isRunning}
  readOnly={isGuided}
  highlights={selectedGuide?.highlights ?? []}
  onChange={(value) => {
    if (isGuided) return;
    setContents((current) => ({ ...current, [selectedPath]: value }));
  }}
/>
```

`.code-explorer__actions` と `OutputPanel` は `isGuided` のとき描画しない。ガイドなしでは現行分岐をそのまま使う。

- [ ] **Step 4: Monaco の行強調と SSR fallback を実装する**

`EditorRuntime` に `highlightDecorations?: Monaco.editor.IEditorDecorationsCollection` を追加する。初期化時と `path` / `highlights` 変更時に、whole-line decoration を更新する。

```ts
const updateHighlights = (
  runtime: EditorRuntime,
  model: Monaco.editor.ITextModel | undefined,
  highlights: readonly CodeHighlight[],
): void => {
  runtime.highlightDecorations?.clear();
  if (model === undefined || highlights.length === 0) return;

  runtime.highlightDecorations = runtime.editor.createDecorationsCollection(
    highlights.map(({ startLineNumber, endLineNumber }) => ({
      range: new runtime.monaco.Range(
        startLineNumber,
        1,
        endLineNumber,
        model.getLineMaxColumn(endLineNumber),
      ),
      options: {
        isWholeLine: true,
        className: "code-explorer__highlighted-line",
        linesDecorationsClassName: "code-explorer__highlighted-gutter",
      },
    })),
  );
  const first = highlights[0];
  if (first !== undefined) {
    runtime.editor.revealRangeInCenter(
      new runtime.monaco.Range(
        first.startLineNumber,
        1,
        first.endLineNumber,
        1,
      ),
    );
  }
};
```

Monaco の `readOnly` は `disabled || readOnly` とし、SSR fallback は `value.split("\n")` を行ごとの `<span data-line>` として描画する。範囲内の行だけ `code-explorer__source-line--highlighted` を付ける。cleanup では decoration も clear する。

- [ ] **Step 5: ガイドと強調行をスタイルする**

`code-playground.css` に以下の責務を持つスタイルを追加する。

```css
.code-playground .code-explorer__guides {
  min-width: 0;
  max-height: 38rem;
  margin: 0;
  padding: 0.75rem;
  overflow: auto;
  border: 0.1875rem solid var(--playground-text);
  border-radius: var(--radius);
  background: var(--playground-background);
  list-style: none;
}

.code-playground .code-explorer__guides li + li {
  margin-top: 0.5rem;
}

.code-playground .code-explorer__guides button {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.625rem;
  padding: 0.625rem;
  border: 0.125rem solid transparent;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--playground-text);
  text-align: left;
  cursor: pointer;
}

.code-playground .code-explorer__guides button[aria-pressed="true"] {
  border-color: var(--playground-primary);
  background: var(--playground-highlight);
  font-weight: 900;
}

.code-playground .code-explorer__guide-detail {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border-left: 0.375rem solid var(--playground-danger);
  background: var(--playground-lemon);
}

.code-playground .code-explorer__highlighted-line,
.code-playground .code-explorer__source-line--highlighted {
  background: color-mix(in srgb, var(--playground-danger) 24%, transparent);
}

.code-playground .code-explorer__highlighted-gutter {
  border-left: 0.25rem solid var(--playground-danger);
}
```

SSR の各 source line は `display: block` とする。既存の `47.99rem` media query ではガイド一覧とエディタを縦積みにする。

- [ ] **Step 6: 対象テストと既存 Code Explorer 回帰を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/CodeExplorer.test.tsx src/components/code-explorer/MonacoEditor.test.tsx src/components/code-explorer/SessionCodePlayground.test.ts
```

Expected: PASS。新しいガイドテストに加え、編集、実行、停止、リセットの既存テストも成功する。

- [ ] **Step 7: Task 1 をコミットする**

```bash
git add apps/docs/src/code-explorer/code-guide.ts
git add apps/docs/src/components/code-explorer/CodeExplorer.tsx
git add apps/docs/src/components/code-explorer/CodeExplorer.test.tsx
git add apps/docs/src/components/code-explorer/MonacoEditor.tsx
git add apps/docs/src/components/code-explorer/MonacoEditor.test.tsx
git add apps/docs/src/styles/code-playground.css
git commit -m "feat(docs): add guided Code Explorer mode"
```

---

### Task 2: Session 00 の5つの設計課題をデータとして定義する

**Files:**
- Create: `apps/docs/src/code-explorer/onboarding-guides.ts`
- Test: `apps/docs/src/code-explorer/onboarding-guides.test.ts`
- Read only: `examples/session-00/src/appointment.ts`
- Read only: `examples/session-00/src/logger.ts`

**Interfaces:**
- Consumes: Task 1 の `CodeGuide`。
- Produces: `export const onboardingGuides: readonly CodeGuide[]`。Task 3 の `SessionCodeOverview.astro` が使用する。

- [ ] **Step 1: source と強調範囲の対応を検証する失敗テストを書く**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { onboardingGuides } from "./onboarding-guides";

const sources = {
  "src/appointment.ts": readFileSync(
    new URL("../../../../examples/session-00/src/appointment.ts", import.meta.url),
    "utf8",
  ),
  "src/logger.ts": readFileSync(
    new URL("../../../../examples/session-00/src/logger.ts", import.meta.url),
    "utf8",
  ),
} as const;

const expectedEvidence = {
  "string-status": ["status: string", "newStatus: string"],
  "optional-state-data": ["veterinarianId?: string", "cancelReason?: string"],
  "plain-string-ids": ["id: string", "petId: string", "ownerId: string"],
  "throw-not-found": ["throw new Error"],
  "raw-pii-log": ["ownerEmail: string", 'logger.info("appointment booked", appointment)'],
} as const;

describe("onboardingGuides", () => {
  it("points every unique guide at real source and evidence", () => {
    expect(onboardingGuides).toHaveLength(5);
    expect(new Set(onboardingGuides.map(({ id }) => id)).size).toBe(5);

    for (const guide of onboardingGuides) {
      const source = sources[guide.path as keyof typeof sources];
      expect(source, guide.path).toEqual(expect.any(String));
      const lines = source.split("\n");
      const highlighted = guide.highlights
        .flatMap(({ startLineNumber, endLineNumber }) =>
          lines.slice(startLineNumber - 1, endLineNumber),
        )
        .join("\n");
      for (const evidence of expectedEvidence[guide.id]) {
        expect(highlighted).toContain(evidence);
      }
    }
  });
});
```

- [ ] **Step 2: テストを実行して RED を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/onboarding-guides.test.ts
```

Expected: `onboarding-guides.ts` が存在しないため FAIL。

- [ ] **Step 3: 5つの課題定義を実装する**

`onboarding-guides.ts` に次の範囲を正確に定義する。

```ts
import type { CodeGuide } from "./code-guide";

export const onboardingGuides = [
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と更新先の状態を string で受け取っています。",
    futureRisk: "業務で使う状態と許可する遷移を型から判断できません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 22, endLineNumber: 22 },
      { startLineNumber: 49, endLineNumber: 52 },
    ],
  },
  {
    id: "optional-state-data",
    title: "状態固有の情報が optional field に広がっている",
    currentDesign: "診察、会計、キャンセルの情報が1つの optional field 群に同居しています。",
    futureRisk: "どの状態で何が必須なのかを型から判断できません。",
    path: "src/appointment.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 10 }],
  },
  {
    id: "plain-string-ids",
    title: "用途の異なる ID がすべて string である",
    currentDesign: "予約、動物、飼い主の ID が同じ string です。",
    futureRisk: "同じ実行時形式の ID を TypeScript が区別できません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 12, endLineNumber: 19 },
      { startLineNumber: 26, endLineNumber: 33 },
    ],
  },
  {
    id: "throw-not-found",
    title: "予期可能な失敗を throw している",
    currentDesign: "予約が見つからない場合に例外を送出します。",
    futureRisk: "呼び出し側が扱う失敗の種類を関数の型から判断できません。",
    path: "src/appointment.ts",
    highlights: [{ startLineNumber: 54, endLineNumber: 55 }],
  },
  {
    id: "raw-pii-log",
    title: "個人情報を含む値をそのままログへ渡している",
    currentDesign: "連絡先を含む予約オブジェクトを logger.info へ渡しています。",
    futureRisk: "ログへ出してよい情報の境界が値や型に表れていません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 18, endLineNumber: 19 },
      { startLineNumber: 45, endLineNumber: 45 },
    ],
  },
] as const satisfies readonly CodeGuide[];
```

- [ ] **Step 4: 課題データのテストを通す**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/onboarding-guides.test.ts
```

Expected: PASS。5 ID が一意で、すべての範囲が現在の session-00 source 内の期待コードを含む。

- [ ] **Step 5: Task 2 をコミットする**

```bash
git add apps/docs/src/code-explorer/onboarding-guides.ts
git add apps/docs/src/code-explorer/onboarding-guides.test.ts
git commit -m "feat(docs): define Session 00 design guides"
```

---

### Task 3: 00-B を廃止してオンボーディングページへ統合する

**Files:**
- Create: `apps/docs/src/components/code-explorer/SessionCodeOverview.astro`
- Create: `apps/docs/src/components/code-explorer/SessionCodeOverview.test.ts`
- Create: `apps/docs/src/pages/sessions/00-onboarding.astro`
- Delete: `apps/docs/src/pages/sessions/00-break-the-app.astro`
- Delete: `apps/docs/src/pages/sessions/00-read-the-incident.astro`
- Modify: `apps/docs/src/sessions/catalog.ts`
- Modify: `apps/docs/src/sessions/catalog.test.ts`
- Modify: `apps/docs/src/code-explorer/session-workspaces.ts`
- Modify: `apps/docs/src/code-explorer/session-workspaces.test.ts`
- Modify: `apps/docs/src/pages/code-explorer.astro`
- Modify: `apps/docs/src/pages/404.astro`
- Modify: `apps/docs/src/test/pages/sessions/session-00.test.ts`
- Modify: `apps/docs/src/test/pages/sessions/code-playground.test.ts`
- Modify: `apps/docs/src/test/pages/code-explorer.test.ts`
- Modify: `apps/docs/src/test/pages/site-contract.test.ts`
- Modify: `apps/docs/src/test/layouts/SessionLayout.test.ts`
- Modify: `apps/docs/src/components/code-explorer/SessionCodePlayground.test.ts`
- Modify: `apps/docs/scripts/verify-static-build.mjs`
- Modify: `apps/docs/e2e/session-code-playground.spec.ts`
- Modify: `worker/routes.ts`
- Modify: `worker/routes.test.ts`
- Modify: `worker/index.test.ts`
- Modify: `apps/docs/src/styles/sessions.css`

**Interfaces:**
- Consumes: Task 1 の `CodeExplorer guides`、Task 2 の `onboardingGuides`、既存 `projectFilesFor` と `sessionWorkspaceFor`。
- Produces: 正規 Session 00 route `/sessions/00-onboarding/`、Session 00 → Session 01 の neighbor、3つの互換リダイレクト、`SessionCodeOverview`。

- [ ] **Step 1: カタログ、route、ページ構造の失敗テストを書く**

`catalog.test.ts` の期待順を次へ変更する。

```ts
expect(sessions.map(({ slug }) => slug)).toEqual([
  "00-onboarding",
  "01-state-modeling",
  "02-boundary-and-ids",
  "03-result-errors",
  "04-agent-review",
  "05-mini-integration",
  "final",
]);
expect(sessionNeighbors("01-state-modeling")).toEqual({
  previous: sessions[0],
  next: sessions[2],
});
```

`worker/routes.test.ts` の redirect cases を次へ変更する。

```ts
it.each([
  "/module-00",
  "/module-00/",
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
])("redirects the legacy path %s", (pathname) => {
  expect(resolveWorkerRoute(pathname)).toEqual({
    kind: "redirect",
    location: "/sessions/00-onboarding/",
  });
});
```

`session-00.test.ts` は旧2ページのテストを削除し、新ページに対して次を検証する。

```ts
import OnboardingPage from "../../../pages/sessions/00-onboarding.astro";

it("onboards the successor without starting an incident exercise", async () => {
  const container = await createAstroContainer();
  const html = await container.renderToString(OnboardingPage, { partial: false });
  const document = parseStaticMarkup(html);

  expect(document.querySelector("h1")?.textContent).toContain(
    "オンボーディング: 退職した先人のコードを引き継ぐ",
  );
  expect(html).toContain("すべてバイブコーディングで作りました");
  expect(html).toContain("そこで採用されたエンジニアが、あなたです");
  expect(html).not.toContain("事故報告");
  expect(html).not.toContain("事故を再現");
  expect(html).not.toContain("pnpm exercise:00");
  expect(html).not.toContain('data-action="run"');
  expect(html).not.toContain('data-action="reset"');
});
```

既存の来院 timeline assertion は同じテストファイルに残す。さらに `.onboarding-story` の `role="group"`、話者順 `先人の獣医, 院長, 院長`、5 guide button、締めの全文を検証する。

`site-contract.test.ts` は authored page と sessions を7件に変更する。`SessionLayout.test.ts` は Session 01 の previous href を `/sessions/00-onboarding/` にする。

- [ ] **Step 2: route とページテストを実行して RED を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/sessions/catalog.test.ts src/test/pages/sessions/session-00.test.ts src/test/pages/site-contract.test.ts src/test/layouts/SessionLayout.test.ts ../../worker/routes.test.ts ../../worker/index.test.ts
```

Expected: 新 slug、新ページ、ガイド wrapper、redirect が未実装のため FAIL。

- [ ] **Step 3: セッションカタログと workspace を統合する**

`SessionSummary.sequence` の union を `"00" | "01" | "02" | "03" | "04" | "05" | "Final"` に変更し、先頭 entry を次の1件だけにする。

```ts
{
  slug: "00-onboarding",
  snapshot: "session-00",
  sequence: "00",
  label: "DOG",
  title: "オンボーディング: 退職した先人のコードを引き継ぐ",
  durationMinutes: 30,
  animal: { name: "DOG", type: "dog", avatar: "🐕" },
  summary:
    "WAN NYAN CLINIC の業務とアプリケーション、先人のコードに残る設計課題を概観します。",
},
```

`sessionWorkspaces` の先頭は次へ置き換える。

```ts
"00-onboarding": {
  initialFile: "src/appointment.ts",
  description: "先人が残したコードを手がかりに、今後向き合う設計上の課題を見渡します。",
  visibleFiles: ["src/appointment.ts", "src/logger.ts"],
},
```

workspace tests の snapshot key と immutable test slug も `00-onboarding` に更新し、00-B 同一 snapshot assertion は削除する。

- [ ] **Step 4: SessionCodeOverview wrapper を作成する**

```astro
---
import { onboardingGuides } from "../../code-explorer/onboarding-guides";
import { projectFilesFor } from "../../code-explorer/project-files";
import { sessionWorkspaceFor } from "../../code-explorer/session-workspaces";
import "../../styles/code-playground.css";
import { CodeExplorer } from "./CodeExplorer";

const slug = "00-onboarding";
const workspace = sessionWorkspaceFor(slug);
const projectFiles = projectFilesFor(slug);
---

<section class="session-code-overview code-playground" aria-labelledby="design-overview">
  <h2 id="design-overview">先人のコードを眺める</h2>
  <p>今日は修正せず、後続セッションで確認する設計課題の場所を把握します。</p>
  <div data-code-explorer={workspace.slug} data-code-overview>
    <CodeExplorer
      client:load
      workspace={workspace}
      projectFiles={projectFiles}
      guides={onboardingGuides}
    />
  </div>
</section>
```

`SessionCodeOverview.test.ts` では h2、5つの課題タイトル、`data-code-overview`、`astro-island[client="load"]`、初期 source、実行・リセット文言の不在を検証する。

- [ ] **Step 5: Session 00 ページをオンボーディング overview として作る**

`00-onboarding.astro` は `CommandBlock` と `SessionCodePlayground` を import せず、`SessionCodeOverview` を使う。目次と H2 は次の順に固定する。

```astro
<ol slot="toc">
  <li><a href="#onboarding">着任初日のオンボーディング</a></li>
  <li><a href="#domain-and-application">この病院とアプリケーションを知る</a></li>
  <li><a href="#visit-and-code">来院とコードの対応を知る</a></li>
  <li><a href="#design-overview">先人のコードを眺める</a></li>
  <li><a href="#handoff">明日の開発に備える</a></li>
</ol>
```

最初の section に承認済みの3発言を置く。

```astro
<section id="onboarding">
  <h2>着任初日のオンボーディング</h2>
  <div class="onboarding-story" role="group" aria-label="先人の獣医から新任エンジニアへの引き継ぎ">
    <div class="onboarding-story__line onboarding-story__line--veterinarian">
      <p class="onboarding-story__speaker">先人の獣医</p>
      <p class="onboarding-story__bubble">この動物病院のシステムは、診療の合間にすべてバイブコーディングで作りました！</p>
    </div>
    <div class="onboarding-story__line onboarding-story__line--director">
      <p class="onboarding-story__speaker">院長</p>
      <p class="onboarding-story__bubble">その偉大な獣医さんが退職してしまいました。システムのことを詳しく知る人がいません……</p>
    </div>
    <div class="onboarding-story__line onboarding-story__line--director">
      <p class="onboarding-story__speaker">院長</p>
      <p class="onboarding-story__bubble">そこで採用されたエンジニアが、あなたです。まずは病院の仕事と先人のコードを知るところから始めてください</p>
    </div>
  </div>
</section>
```

`#domain-and-application` には現在の「動物病院の役割」「1回の来院の流れ」「登場人物」「提供する機能と価値」を移す。`#visit-and-code` には現在の4段階の `visit-timeline`、Canceled 分岐、終端状態の業務ルールを残し、続けて次の対応表を追加する。

```astro
<table>
  <thead><tr><th scope="col">業務上の概念</th><th scope="col">コード</th></tr></thead>
  <tbody>
    <tr><th scope="row">来院記録</th><td><code>LegacyAppointment</code></td></tr>
    <tr><th scope="row">予約を受け付ける</th><td><code>bookAppointment</code></td></tr>
    <tr><th scope="row">状態を更新する</th><td><code>updateStatus</code></td></tr>
    <tr><th scope="row">運用ログ</th><td><code>logger.info</code></td></tr>
  </tbody>
</table>
```

`SessionCodeOverview` の後、締めを正確に置く。

```astro
<section id="handoff">
  <h2>明日の開発に備える</h2>
  <p class="onboarding-decision">
    しかし、まだ問題は顕在化していません。迂闊にリファクタリングすれば、既存仕様を壊してしまうかもしれません。今日は業務、仕様、設計の理解に留め、明日から実際の開発に着手しましょう。
  </p>
  <h3>完了条件</h3>
  <p>アプリケーションが支える業務と、既存設計で後から確認すべき5つの場所を説明できることです。</p>
  <h3>次のセッションへ</h3>
  <p>最初に扱う要求を確認し、状態と状態固有のデータを TypeScript の型で表します。</p>
</section>
```

- [ ] **Step 6: 吹き出しと締めをスタイルする**

`sessions.css` に `.onboarding-story`、`__line`、`__speaker`、`__bubble` と左右のしっぽを追加する。既存 `.requirement-dialogue` を流用・改名しない。院長を右寄せし、`--case-lemon` と `--case-mint` を使う。`onboarding-decision` は coral の左罫線と lemon 背景を使う。モバイルでは最大幅を100%にする。

- [ ] **Step 7: 旧ページを削除し、route・静的契約・テスト参照を一度に同期する**

`worker/routes.ts` は redirect path を Set にまとめる。

```ts
const onboardingRedirects = new Set([
  "/module-00",
  "/module-00/",
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
]);

if (onboardingRedirects.has(pathname)) {
  return { kind: "redirect", location: "/sessions/00-onboarding/" };
}
```

以下を同じ commit 内で同期する。

- `pages/code-explorer.astro` と standalone test の slug を `00-onboarding` にする。
- `404.astro` の最初のセッションリンクを `/sessions/00-onboarding/` にする。
- `SessionCodePlayground.test.ts` の Session 00 case を Session 01 case に置き換える。
- `code-playground.test.ts` と Playwright routes から Session 00-A/00-B を除き、Session 01〜05 と final の6件を維持する。
- `verify-static-build.mjs` の required HTML を `sessions/00-onboarding/index.html` と Session 01〜final の7 session pages にする。
- `site-contract.test.ts` の authored pages と catalog length を7にする。
- `SessionLayout.test.ts` の Session 01 previous URL を `/sessions/00-onboarding/` にする。
- `worker/index.test.ts` の redirect Location を `/sessions/00-onboarding/` にする。
- 旧2 Astro files を削除する。

- [ ] **Step 8: Task 3 の対象テストを通す**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/sessions/catalog.test.ts src/code-explorer/session-workspaces.test.ts src/components/code-explorer/SessionCodeOverview.test.ts src/components/code-explorer/SessionCodePlayground.test.ts src/test/pages/sessions/session-00.test.ts src/test/pages/sessions/code-playground.test.ts src/test/pages/code-explorer.test.ts src/test/pages/site-contract.test.ts src/test/layouts/SessionLayout.test.ts ../../worker/routes.test.ts ../../worker/index.test.ts
```

Expected: PASS。Session 00 は1ページ、7 catalog entries、3 redirect groups、既存6 interactive playgrounds になる。

- [ ] **Step 9: Task 3 をコミットする**

```bash
git add apps/docs/src worker
git commit -m "feat(docs): consolidate Session 00 onboarding"
```

---

### Task 4: トップページと当日進行をオンボーディングへ同期する

**Files:**
- Modify: `apps/docs/src/pages/index.astro:20-25,104-119`
- Modify: `apps/docs/src/test/pages/index.test.ts`
- Modify: `docs/event/facilitator-guide.md:5-36`

**Interfaces:**
- Consumes: Task 3 の正規 URL、タイトル、30分構成、5つの設計課題。
- Produces: 参加者が事故再現ではなくオンボーディングから開始するトップページ導線と、0:10-0:40 の進行契約。

- [ ] **Step 1: トップページ導線の失敗テストを書く**

`index.test.ts` の旧 href assertion を次へ置き換える。

```ts
const sessionLink = document.querySelector<HTMLAnchorElement>(
  'a[href="/sessions/00-onboarding/"]',
);
expect(sessionLink).not.toBeNull();
expect(document.body.textContent).toContain(
  "オンボーディング: 退職した先人のコードを引き継ぐ",
);
expect(document.querySelector("#sessions")?.textContent).toContain(
  "業務と先人のコードを理解する",
);
expect(document.querySelector("#sessions")?.textContent).not.toContain(
  "事故を再現",
);
```

- [ ] **Step 2: トップページテストを実行して RED を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/index.test.ts
```

Expected: 旧 link と事故再現 copy が残っているため FAIL。

- [ ] **Step 3: トップページの Session 00 導線を更新する**

- header の SESSION 00 href を `/sessions/00-onboarding/` にする。
- `#sessions` の見出しを「新任エンジニアとして着任する」にする。
- lead を「あなたの最初の仕事は、動物病院の業務と先人のコードを理解することです。問題が顕在化する前に書き換えず、後から確認すべき設計課題の場所を把握します。」にする。
- doc pane title を承認済みタイトルへ変更し、説明を「退職した先人からシステムを引き継ぎ、業務、アプリケーション、5つの設計課題を概観します。」にする。
- help wanted code の最後を次にする。

```text
着任初日の仕事:
/sessions/00-onboarding/ を開いて、業務と先人のコードを理解する
```

- [ ] **Step 4: ファシリテーターガイドを同期する**

タイムテーブルの最初の2セッション行を1行にまとめる。

```markdown
| 0:10-0:40 | 15:10-15:40 | 新任エンジニアとして業務、アプリケーション、5つの設計課題を概観 | `00-onboarding` |
```

`### 0:30 状態モデリングへ進む` を `### 0:30 オンボーディングの理解を確認する` に変更し、確認項目を次にする。

```markdown
- 予約から会計までの業務の流れと、アプリケーションが支える仕事を説明できる
- string status、optional field、同じ型の ID、throw、PII ログの5箇所をコード上で見つけられる
- 問題が顕在化していない段階では、既存仕様を理解せずに書き換えない判断を説明できる
- Session 01 で最初の具体的な要求と状態モデリングへ進むことを把握している
```

- [ ] **Step 5: トップページテストと文言検索を確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs exec vitest run src/test/pages/index.test.ts
grep -RIn --exclude-dir=node_modules --exclude-dir=dist '00-read-the-incident\|/sessions/00-break-the-app/' apps/docs/src docs/event worker
```

Expected: Vitest PASS。grep は `worker/routes.ts` と redirect tests にある互換 URL だけを表示し、参加者向け link やイベント資料には表示しない。

- [ ] **Step 6: Task 4 をコミットする**

```bash
git add apps/docs/src/pages/index.astro
git add apps/docs/src/test/pages/index.test.ts
git add docs/event/facilitator-guide.md
git commit -m "docs: sync Session 00 onboarding guidance"
```

---

### Task 5: 全体検証と実装差分の監査

**Files:**
- Verify: `docs/superpowers/specs/2026-08-08-session-00-onboarding-story-design.md`
- Verify: Task 1〜4 の全変更ファイル

**Interfaces:**
- Consumes: Task 1〜4 の完成差分。
- Produces: typecheck、通常テスト、静的ビルドが成功し、exercise source を変更していない作業ブランチ。

- [ ] **Step 1: 変更差分に空白エラーや想定外ファイルがないことを確認する**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
```

Expected: `git diff --check` は出力なし。status は clean。差分は設計書、計画書、docs app、worker route、facilitator guide に限定される。

- [ ] **Step 2: TypeScript と Astro の型検査を実行する**

Run:

```bash
pnpm typecheck
```

Expected: PASS。examples、docs、worker の型エラーが0件。

- [ ] **Step 3: 通常テストをすべて実行する**

Run:

```bash
pnpm test
```

Expected: PASS。`exercise:00` は意図的失敗のままなので、この通常テストには含めず、実行しない。

- [ ] **Step 4: 静的ビルドと内部 link 検証を実行する**

Run:

```bash
pnpm build
```

Expected: PASS。`sessions/00-onboarding/index.html` を含む7 session pages が生成され、旧2ページは生成されず、内部 link はすべて解決する。

- [ ] **Step 5: 設計書の受け入れ条件を差分へ照合する**

次を目視で1件ずつ確認する。

- タイトル、30分、正規 URL、3互換リダイレクト。
- 3つの吹き出しと話者ラベル。
- 業務、アプリケーション、来院、コード対応。
- 5つの課題、課題切り替え、行強調、読み取り専用。
- Session 00 内の事故説明、exercise command、mutable controls の不在。
- 承認済みの締め全文。
- 00-B の catalog、page、workspace、build target からの削除。
- Session 01 以降の interactive Code Explorer 回帰。

- [ ] **Step 6: 検証結果に応じて完了状態を確定する**

すべて成功した場合、Task 5 だけの commit は作らない。失敗があった場合は、変更責務を持つ Task 1〜4 のテスト作成ステップへ戻り、その Task に列挙されたファイルだけで新しい RED→GREEN の反復を行う。修正後は Task 5 の Step 1 から全検証をやり直す。

Expected: 作業 tree が clean。実装 commit は責務別に分かれ、検証だけの空 commit はない。

---

## Completion Handoff

全検証成功後は `superpowers:verification-before-completion` と `pr` の手順に従う。同じブランチの未完了 PR がなければ branch を push し、変更目的、主要変更、検証結果、`exercise:00` を実行していない理由を記載した Draft Pull Request を作成する。既存 PR があれば新規作成せず更新する。
