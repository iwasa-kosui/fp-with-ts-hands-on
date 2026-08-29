# Session Playground Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S2〜S6の失敗確認・修正・再実行を、各ページ一つの編集可能なplaygroundで完結させる。

**Architecture:** 静的な設計ガイドはAstroで描画し、編集状態とWebContainerは一つの`CodeExplorer`に集約する。利用者の明示操作でWebContainerを起動し、最初の処理として各セッションの`exerciseCommand`を一度だけ送る。

**Tech Stack:** Astro, React, TypeScript, Vitest, Playwright, WebContainer API

**Spec:** `docs/superpowers/specs/2026-08-30-session-playground-flow-design.md`

## Global Constraints

- 利用者向け文言に「RED」「GREEN」を使わない。
- ローカルとの差分説明は `ブラウザ内の変更はローカルへ反映されません。` の一文だけにする。
- S2〜S6は同じ`CodeExplorer`で失敗確認、編集、成功確認を行う。
- 既存の`code-guides.test.ts`と`project-files.test.ts`は維持する。
- 変更はテスト失敗を確認してから実装する。

---

## Task 1: 静的ガイドと単一playgroundへ統合する

**Files:**

- Create: `apps/docs/src/components/CodeGuideCards.astro`
- Modify: `apps/docs/src/pages/sessions/02-state-transitions.astro`
- Modify: `apps/docs/src/pages/sessions/03-semantic-identifiers.astro`
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro`
- Modify: `apps/docs/src/pages/sessions/06-effects-and-consistency.astro`
- Modify: `apps/docs/e2e/session-code-playground.spec.ts`
- Modify: `apps/docs/src/session-pages.test.ts`

- [ ] **Step 1: 利用者フローの失敗するE2Eを書く**

  S2〜S6のループで、`#legacy`内に静的ガイド、失敗確認コマンド、一つの編集可能なExplorerがこの順であり、`#refactor`に別のplaygroundがないことを検証する。

  ```ts
  const failureFlow = page.locator("#legacy");
  await expect(failureFlow.locator("[data-code-guide-card]")).not.toHaveCount(0);
  await expect(failureFlow.locator(".command-block")).toHaveCount(1);
  await expect(failureFlow.locator(".code-explorer")).toHaveCount(1);
  await expect(failureFlow.getByRole("textbox", { name: "Editor content" })).toBeAttached();
  await expect(page.locator("#refactor .session-code-playground")).toHaveCount(0);
  ```

  既存のguided Explorer専用レイアウト2テストは削除し、デスクトップ・モバイル両viewportの横スクロール検証は残す。

- [ ] **Step 2: 対象E2Eが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs test:visual e2e/session-code-playground.spec.ts`

  Expected: 二つの`CodeExplorer`を描画しているため、新しい件数・配置の期待で失敗する。

- [ ] **Step 3: 軽量ガイドをAstroで実装する**

  `CodeGuideCards.astro`は`guides`と`projectFiles`を受け取り、該当行だけをサーバー描画する。

  ```astro
  ---
  import { Code } from "astro:components";
  import type { CodeGuide } from "../code-explorer/code-guide";
  import type { ProjectFiles } from "../code-explorer/types";

  interface Props {
    guides: readonly CodeGuide[];
    projectFiles: ProjectFiles;
  }

  const { guides, projectFiles } = Astro.props;
  const cards = guides.map((guide) => {
    const source = projectFiles[guide.path];
    if (source === undefined) throw new Error(`Guide source not found: ${guide.path}`);
    return {
      guide,
      excerpts: guide.highlights.map(({ startLineNumber, endLineNumber }) => ({
        startLineNumber,
        endLineNumber,
        source: source.split("\n").slice(startLineNumber - 1, endLineNumber).join("\n"),
      })),
    };
  });
  ---

  <ol class="code-guide-cards" aria-label="配布コードの設計課題">
    {cards.map(({ guide, excerpts }) => (
      <li data-code-guide-card={guide.id}>
        <h4>{guide.title}</h4>
        {excerpts.map(({ startLineNumber, endLineNumber, source }) => (
          <figure>
            <figcaption>{guide.path}:{startLineNumber}-{endLineNumber}</figcaption>
            <Code code={source} lang="ts" />
          </figure>
        ))}
        <p>{guide.currentDesign} {guide.futureRisk}</p>
      </li>
    ))}
  </ol>
  ```

  Scoped CSSはデスクトップ2列、狭幅1列にし、既存のページ変数を使う。

- [ ] **Step 4: S2〜S6を一つの利用者フローへ揃える**

  各ページの`#legacy`を次の順序にする。

  1. `<CodeGuideCards guides={guides} projectFiles={projectFiles} />`
  2. 既存の失敗一覧
  3. `<CommandBlock phase="red" command={session.exerciseCommand} ... />`
  4. `ブラウザ内の変更はローカルへ反映されません。`
  5. `<CodeExplorer client:load workspace={session.workspace} projectFiles={projectFiles} />`

  `#refactor`から「ブラウザで試す」、説明文、二つ目の`CodeExplorer`を削除する。成功確認用の`CommandBlock`は残す。
  既存の「exercise を GREEN にします」は「すべての target file を反映してから検証します」へ置き換える。

- [ ] **Step 5: 実装詳細を数えるテストを削除する**

  `session-pages.test.ts`の`${slug} renders overview guides separately from the playground`だけを削除する。セッションメタデータやworkspace契約の検証は残す。

- [ ] **Step 6: 対象E2Eと単体テストを通す**

  Run: `pnpm --filter @fp-with-ts/docs test:visual e2e/session-code-playground.spec.ts`

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: どちらもpass。

- [ ] **Step 7: コミットする**

  ```bash
  git add apps/docs/src/components/CodeGuideCards.astro apps/docs/src/pages/sessions/02-state-transitions.astro apps/docs/src/pages/sessions/03-semantic-identifiers.astro apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/src/pages/sessions/05-workflow-errors.astro apps/docs/src/pages/sessions/06-effects-and-consistency.astro apps/docs/e2e/session-code-playground.spec.ts apps/docs/src/session-pages.test.ts
  git commit -m "refactor(docs): 失敗確認へ単一playgroundを統合" -m "Co-Authored-By: Codex <noreply@openai.com>"
  ```

---

## Task 2: 起動時に演習コマンドを一度だけ実行する

**Files:**

- Modify: `apps/docs/src/components/code-explorer/CodeExplorer.tsx`
- Modify: `apps/docs/src/components/code-explorer/TerminalPanel.tsx`
- Modify: `apps/docs/src/components/code-explorer/TerminalPanel.test.tsx`
- Modify: `apps/docs/src/pages/sessions/02-state-transitions.astro`
- Modify: `apps/docs/src/pages/sessions/03-semantic-identifiers.astro`
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro`
- Modify: `apps/docs/src/pages/sessions/06-effects-and-consistency.astro`
- Modify: `apps/docs/e2e/session-code-playground.spec.ts`

- [ ] **Step 1: 初回コマンド送信失敗時の解放テストを先に書く**

  `TerminalPanel.test.tsx`で、初回送信に失敗したsessionを解放して再試行可能になることを検証する。

  ```ts
  const session = createSession();
  vi.mocked(session.writeInput).mockRejectedValueOnce(new Error("write failed"));
  const host = await renderPanel({
    initialCommand: "pnpm exercise:02",
    runnerFactory: () => ({ start: async () => session }),
  });
  await clickAction(host, "start-terminal");
  expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:02\r");
  expect(session.dispose).toHaveBeenCalledOnce();
  expect(host.querySelector('[data-action="retry-terminal"]')).not.toBeNull();
  ```

  これはリソース解放の境界テストとしてTask 3後も残す。

- [ ] **Step 2: S2の失敗→編集→成功E2Eを書く**

  既存の「任意コマンドと作成ファイル」テストを置き換える。`examples/session-03/src/domain/appointment/transitions.ts`と`statusLabel.ts`を`readFile`で読み、S2のExplorerで同名ファイルへ貼り付ける。

  ```ts
  import { readFile } from "node:fs/promises";

  const transitionsSolution = await readFile(
    new URL("../../../examples/session-03/src/domain/appointment/transitions.ts", import.meta.url),
    "utf8",
  );
  const statusLabelSolution = await readFile(
    new URL("../../../examples/session-03/src/domain/appointment/statusLabel.ts", import.meta.url),
    "utf8",
  );
  ```

  ```ts
  await page.getByRole("button", { name: "修正前の失敗を確認" }).click();
  await expect(terminal).toContainText(/Tests\s+4 failed/);

  await selectFile("src/domain/appointment/transitions.ts");
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText(transitionsSolution);

  await selectFile("src/domain/appointment/statusLabel.ts");
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText(statusLabelSolution);

  await page.locator(".xterm-helper-textarea").pressSequentially("pnpm exercise:02");
  await page.locator(".xterm-helper-textarea").press("Enter");
  await expect(terminal).toContainText(/Tests\s+4 passed/);
  ```

- [ ] **Step 3: 新しいテストが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs test -- TerminalPanel.test.tsx`

  Run: `pnpm --filter @fp-with-ts/docs test:visual e2e/session-code-playground.spec.ts`

  Expected: `initialCommand`未実装のためfail。

- [ ] **Step 4: `initialCommand`をExplorerからTerminalへ渡す**

  両Propsへ`initialCommand?: string`を追加し、`CodeExplorer`から`TerminalPanel`へ渡す。各ページでは次を指定する。

  ```astro
  <CodeExplorer
    client:load
    workspace={session.workspace}
    projectFiles={projectFiles}
    initialCommand={session.exerciseCommand}
  />
  ```

- [ ] **Step 5: 明示操作後の最初の処理として一度だけ送信する**

  `runner.start()`成功後、ready表示前に送る。送信に失敗した場合はsessionを破棄してfailedへ遷移する。`session`の所有権をrefへ渡すまではローカル変数で管理する。

  `view`と同じスコープに`let session: TerminalSession | undefined`を宣言し、既存の`const session = await runner.start({`を`session = await runner.start({`へ変える。start後に次を挿入する。

  ```ts
  if (initialCommand !== undefined) {
    await session.writeInput(`${initialCommand}\r`);
  }
  terminalSession.current = session;
  onSessionChangeRef.current(session);
  session = undefined;
  ```

  `catch`の先頭で`await session?.dispose()`し、refへ渡していないsessionを解放する。起動ボタンは`initialCommand`がある場合だけ`修正前の失敗を確認`とし、既存の長い隔離環境説明は削除する。シェル再起動処理には送信を追加しない。

- [ ] **Step 6: 単体テストと利用者フローを通す**

  Run: `pnpm --filter @fp-with-ts/docs test -- TerminalPanel.test.tsx`

  Run: `pnpm --filter @fp-with-ts/docs test:visual e2e/session-code-playground.spec.ts`

  Expected: 初回失敗、編集、再実行成功までpass。

- [ ] **Step 7: コミットする**

  ```bash
  git add apps/docs/src/components/code-explorer/CodeExplorer.tsx apps/docs/src/components/code-explorer/TerminalPanel.tsx apps/docs/src/components/code-explorer/TerminalPanel.test.tsx apps/docs/src/pages/sessions/02-state-transitions.astro apps/docs/src/pages/sessions/03-semantic-identifiers.astro apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/src/pages/sessions/05-workflow-errors.astro apps/docs/src/pages/sessions/06-effects-and-consistency.astro apps/docs/e2e/session-code-playground.spec.ts
  git commit -m "feat(docs): playground起動時に演習コマンドを実行" -m "Co-Authored-By: Codex <noreply@openai.com>"
  ```

---

## Task 3: 単体テストをライフサイクル境界へ絞る

**Files:**

- Delete: `apps/docs/src/components/code-explorer/CodeExplorer.test.tsx`
- Modify: `apps/docs/src/components/code-explorer/TerminalPanel.test.tsx`
- Modify: `apps/docs/src/components/code-explorer/MonacoEditor.test.tsx`
- Delete: `apps/docs/src/components/code-explorer/workspace-state.test.ts`
- Modify: `apps/docs/src/code-explorer/runner.test.ts`

- [ ] **Step 1: E2Eと重複するテストを削除する**

  Explorerの編集・リセット・任意コマンド・表示状態はPlaywrightへ委ねる。次だけを残す。

  - 起動中のキャンセル
  - terminal、model、WebContainer sessionの解放
  - `..`を含むworkspace外パスの拒否
  - 初回コマンド送信失敗時のsession解放

  `CodeExplorer.test.tsx`と`workspace-state.test.ts`は削除する。`MonacoEditor.test.tsx`はmodel解放、`TerminalPanel.test.tsx`はキャンセルとsession解放、`runner.test.ts`はキャンセル・解放・パス拒否のケースだけに絞る。

- [ ] **Step 2: 残したテストの失敗を確認する**

  `runner.test.ts`に直接のパス逃逸検証が不足している場合は、先に次を追加する。

  ```ts
  await expect(session.writeFile("../outside.ts", "blocked")).rejects.toThrow(
    "Unsupported workspace path: ../outside.ts",
  );
  ```

  Run: `pnpm --filter @fp-with-ts/docs test -- runner.test.ts`

  Expected: 拒否処理が既存契約と異なる場合のみfailし、実装を契約へ合わせる。既に同じ契約ならpassを確認して次へ進む。

- [ ] **Step 3: 全単体テストを通す**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: pass。未使用importや削除済みsuite参照がない。

- [ ] **Step 4: コミットする**

  ```bash
  git add -A apps/docs/src/components/code-explorer apps/docs/src/code-explorer/runner.test.ts
  git commit -m "test(docs): playground検証を利用者フローへ集約" -m "Co-Authored-By: Codex <noreply@openai.com>"
  ```

---

## Task 4: 完了条件をまとめて検証する

**Files:** Verify only

- [ ] **Step 1: docsの全検証を通す**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Run: `pnpm --filter @fp-with-ts/docs typecheck`

  Run: `pnpm --filter @fp-with-ts/docs build`

  Run: `pnpm --filter @fp-with-ts/docs test:visual e2e/session-code-playground.spec.ts`

  Expected: 全コマンドpass。

- [ ] **Step 2: 文言と構造を静的確認する**

  ```bash
  rg -n 'ブラウザで試す|\bRED\b|\bGREEN\b' apps/docs/src/pages/sessions/{02-state-transitions,03-semantic-identifiers,04-boundaries-and-pii,05-workflow-errors,06-effects-and-consistency}.astro apps/docs/src/components/CodeGuideCards.astro
  rg -n 'ブラウザ内の変更はローカルへ反映されません。' apps/docs/src/pages/sessions/{02-state-transitions,03-semantic-identifiers,04-boundaries-and-pii,05-workflow-errors,06-effects-and-consistency}.astro
  ```

  Expected: 1本目は該当なし。2本目は各ページ一件。

- [ ] **Step 3: デスクトップとモバイルを目視確認する**

  PlaywrightでS2の1440px・390pxスクリーンショットを撮り、ガイド、失敗確認、Explorerの順序、横スクロールなし、文言の重複なしを確認する。

- [ ] **Step 4: 差分を確認する**

  Run: `git status --short`

  Run: `git diff main...HEAD --stat`

  Expected: Issue #107に必要な変更だけが含まれ、未コミット差分がない。
