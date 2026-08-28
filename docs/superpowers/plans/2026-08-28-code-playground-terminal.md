# コードプレイグラウンドのターミナル化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固定の「実行」UIを対話ターミナルへ置き換え、エディタとWebContainerの間で表示対象ファイルを双方向同期します。

**Architecture:** `CodeExplorer` は画面上のファイル状態を純粋な reducer で管理し、`TerminalPanel` はxterm.jsとターミナル状態を管理します。ターミナルランナーはWebContainerの起動、PTY、ファイル監視を隠蔽し、UIへ端末出力と表示可能なファイル変更だけを通知します。

**Tech Stack:** React 18、TypeScript、Astro、WebContainer API 1.6.4、xterm.js、Vitest、Playwright

**Spec:** `docs/superpowers/specs/2026-08-28-code-playground-terminal-design.md`

## Global Constraints

- WebContainerは「ターミナルを起動」が押されるまで起動しません。
- 編集可能なプレイグラウンドだけにターミナルを表示します。
- PTYは`/workspace`で永続的な`jsh`を起動し、ANSI出力、入力、`Ctrl+C`、リサイズを加工せず中継します。
- 初期非表示ファイル、`node_modules`、キャッシュ、ビルド成果物、カバレッジ、`package-lock.json`、バイナリはツリーへ追加しません。
- 初期ファイルのリセットは維持し、ターミナルで作成したファイルのリセットは無効にします。
- ローカルPCのファイル、環境変数、認証情報はWebContainerへ渡しません。
- 既存のファイルツリー密度とエディタ幅を維持し、ターミナルは上段の全幅を使います。

---

### Task 1: 画面上のワークスペース状態を純粋関数へ分離

**Files:**
- Create: `apps/docs/src/code-explorer/workspace-state.ts`
- Create: `apps/docs/src/code-explorer/workspace-state.test.ts`

**Interfaces:**
- Consumes: `ProjectFiles` from `apps/docs/src/code-explorer/types.ts`
- Produces: `createWorkspaceState(projectFiles, visiblePaths, selectedPath)`, `reduceWorkspaceState(state, action)`, `canResetFile(projectFiles, path)`

- [ ] **Step 1: 追加・変更・削除・リセットの失敗テストを書く**

```ts
const initial = createWorkspaceState(
  { "src/main.ts": "initial", "package.json": "{}" },
  ["src/main.ts"],
  "src/main.ts",
);

const created = reduceWorkspaceState(initial, {
  kind: "external-write",
  path: "src/created.ts",
  contents: "created",
});
expect(created.visiblePaths).toEqual(["src/created.ts", "src/main.ts"]);
expect(canResetFile(initial.contents, "src/created.ts")).toBe(false);

const deleted = reduceWorkspaceState(created, {
  kind: "external-delete",
  path: "src/created.ts",
});
expect(deleted.selectedPath).toBe("src/main.ts");
```

`edit`、`select`、`reset`、選択中ファイルの削除、最後のファイルの削除、同値書き込みで参照が変わらないことも同じテストファイルで検証します。

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/workspace-state.test.ts`

Expected: `workspace-state.ts` が存在しないためFAILします。

- [ ] **Step 3: reducerを最小実装する**

```ts
export type WorkspaceState = Readonly<{
  contents: ProjectFiles;
  visiblePaths: readonly string[];
  selectedPath: string | undefined;
}>;

export type WorkspaceAction =
  | Readonly<{ kind: "select"; path: string }>
  | Readonly<{ kind: "edit"; path: string; contents: string }>
  | Readonly<{ kind: "reset"; path: string; contents: string }>
  | Readonly<{ kind: "external-write"; path: string; contents: string }>
  | Readonly<{ kind: "external-delete"; path: string }>;
```

新規パスを含む一覧は`localeCompare`で安定して並べ、選択中ファイルを削除した場合は先頭の残存パスを選びます。残存パスがなければ`selectedPath`を`undefined`にします。

- [ ] **Step 4: 対象テストを再実行して成功を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/workspace-state.test.ts`

Expected: PASSします。

- [ ] **Step 5: ワークスペース状態をコミットする**

```bash
git add apps/docs/src/code-explorer/workspace-state.ts apps/docs/src/code-explorer/workspace-state.test.ts
git commit -m "feat(docs): プレイグラウンドの動的ファイル状態を管理"
```

---

### Task 2: WebContainerを永続PTYセッションへ置き換える

**Files:**
- Modify: `apps/docs/src/code-explorer/runner.ts`
- Modify: `apps/docs/src/code-explorer/runner.test.ts`

**Interfaces:**
- Consumes: `ProjectFiles`
- Produces: `TerminalRunner`, `TerminalSession`, `TerminalStartRequest`, `TerminalSize`, `WorkspaceChange`, `createTerminalRunner(loadRuntime)`, `createWebContainerTerminalRunner()`

- [ ] **Step 1: ターミナルセッションとファイル監視の失敗テストを書く**

```ts
const session = await createTerminalRunner(async () => runtime).start({
  files: { "src/main.ts": "edited", "package.json": "{}" },
  visibleFiles: ["src/main.ts"],
  size: { cols: 80, rows: 24 },
  onPhase: (phase) => phases.push(phase),
  onOutput: (chunk) => output.push(chunk),
  onTypeFiles: (files) => typeFiles.push(files),
  onWorkspaceChange: (change) => changes.push(change),
  onExit: (exitCode) => exits.push(exitCode),
});

await session.writeInput("pnpm test\r");
session.resize({ cols: 120, rows: 40 });
await session.restartShell({ cols: 120, rows: 40 });
await session.dispose();
```

次もテストします。

- 準備フェーズが`booting`、`mounting`、`installing`、`collecting-types`、`starting-shell`の順になること
- インストール失敗時にランタイムを破棄し、次の`start`で再試行できること
- PTY出力をANSI文字列のまま通知すること
- 初期表示ファイルの変更・削除を通知すること
- 新規UTF-8テキストを通知すること
- 初期非表示ファイル、`node_modules`、`.cache`、`.vite`、`.astro`、`dist`、`coverage`、`package-lock.json`を通知しないこと
- 不正UTF-8またはNUL文字を含むファイルを通知しないこと
- 監視イベントを直列処理し、同じ内容を重複通知しないこと
- `../fixtures`だけをワークスペース外へ配置し、それ以外の親参照を拒否すること

- [ ] **Step 2: runnerテストを実行して失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/runner.test.ts`

Expected: `TerminalRunner`系の型とメソッドがないためFAILします。

- [ ] **Step 3: ランナー境界をPTY向けに実装する**

```ts
export type TerminalSize = Readonly<{ cols: number; rows: number }>;
export type TerminalPhase =
  | "booting"
  | "mounting"
  | "installing"
  | "collecting-types"
  | "starting-shell";
export type WorkspaceChange =
  | Readonly<{ kind: "write"; path: string; contents: string }>
  | Readonly<{ kind: "delete"; path: string }>;

export type TerminalStartRequest = Readonly<{
  files: ProjectFiles;
  visibleFiles: readonly string[];
  size: TerminalSize;
  onPhase: (phase: TerminalPhase) => void;
  onOutput: (chunk: string) => void;
  onTypeFiles: (files: ProjectFiles) => void;
  onWorkspaceChange: (change: WorkspaceChange) => void;
  onExit: (exitCode: number) => void;
}>;

export type TerminalSession = Readonly<{
  writeInput: (data: string) => Promise<void>;
  writeFile: (path: string, contents: string) => Promise<void>;
  resize: (size: TerminalSize) => void;
  restartShell: (size: TerminalSize) => Promise<void>;
  dispose: () => Promise<void>;
}>;

export type TerminalRunner = Readonly<{
  start: (request: TerminalStartRequest) => Promise<TerminalSession>;
}>;

export type TerminalRuntimeProcess = Readonly<{
  input: WritableStream<string>;
  output: ReadableStream<string>;
  exit: Promise<number>;
  kill: () => void;
  resize: (size: TerminalSize) => void;
}>;

export type TerminalRuntime = Readonly<{
  mount: (files: ProjectFiles) => Promise<void>;
  install: () => Promise<number>;
  readTypeFiles: () => Promise<ProjectFiles>;
  watchWorkspace: (onPath: (path: string) => void) => () => void;
  readWorkspaceFile: (path: string) => Promise<string | Uint8Array>;
  writeWorkspaceFile: (path: string, contents: string) => Promise<void>;
  spawnShell: (size: TerminalSize) => Promise<TerminalRuntimeProcess>;
  dispose: () => void | Promise<void>;
}>;
```

`TerminalRuntime`では`mount`、`install`、`readTypeFiles`、`watchWorkspace`、`readWorkspaceFile`、`writeWorkspaceFile`、`spawnShell`、`dispose`を抽象化します。WebContainerアダプターでは`spawn("jsh", [], { cwd: "workspace", terminal: size })`を使い、processの`input`、`output`、`resize`、`kill`を中継します。

監視コールバックはPromiseチェーンへ追加して直列化します。パスを正規化し、`TextDecoder("utf-8", { fatal: true })`とNUL文字チェックを通過したファイルだけを通知します。ファイルが`ENOENT`なら、以前に表示対象として通知したパスだけ削除通知を送ります。

- [ ] **Step 4: runnerテストを再実行して成功を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/code-explorer/runner.test.ts`

Expected: PASSします。

- [ ] **Step 5: PTYランナーをコミットする**

```bash
git add apps/docs/src/code-explorer/runner.ts apps/docs/src/code-explorer/runner.test.ts
git commit -m "feat(docs): WebContainerを永続PTYセッションへ変更"
```

---

### Task 3: xterm.jsを表示するTerminalPanelを追加

**Files:**
- Modify: `apps/docs/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/docs/src/components/code-explorer/TerminalPanel.tsx`
- Create: `apps/docs/src/components/code-explorer/TerminalPanel.test.tsx`
- Modify: `apps/docs/src/components/code-explorer/SessionCodePlayground.astro`

**Interfaces:**
- Consumes: `TerminalRunner`, `TerminalSession`, `ProjectFiles`, `WorkspaceChange`
- Produces: `TerminalPanel`, `TerminalPanelProps`, `TerminalPanelStateKind`, `TerminalView`, `createXtermView()`

- [ ] **Step 1: xterm.js依存関係を追加する**

Run: `pnpm --filter @fp-with-ts/docs add @xterm/xterm @xterm/addon-fit`

Expected: `apps/docs/package.json`と`pnpm-lock.yaml`へ解決済みバージョンが記録されます。

- [ ] **Step 2: TerminalPanelの状態遷移テストを書く**

```tsx
const view: TerminalView = {
  open: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  fit: vi.fn(() => ({ cols: 100, rows: 30 })),
  focus: vi.fn(),
  dispose: vi.fn(),
};

render(
  <TerminalPanel
    files={{ "src/main.ts": "source" }}
    visibleFiles={["src/main.ts"]}
    runnerFactory={() => runner}
    supportsRuntime={() => true}
    loadTerminalView={async () => view}
    onTypeFiles={onTypeFiles}
    onWorkspaceChange={onWorkspaceChange}
    onSessionChange={onSessionChange}
    onStateChange={onStateChange}
  />,
);
```

起動前はボタンだけを表示し、準備フェーズを日本語で表示し、準備完了後に端末を開くことを検証します。未対応ブラウザ、起動失敗と再試行、シェル終了と同一セッションでの再起動、PTY入力、FitAddon相当のリサイズ、アンマウント時の全リソース解放も検証します。

- [ ] **Step 3: TerminalPanelテストを実行して失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/TerminalPanel.test.tsx`

Expected: `TerminalPanel.tsx`が存在しないためFAILします。

- [ ] **Step 4: TerminalPanelとxtermアダプターを実装する**

```ts
export type TerminalView = Readonly<{
  open: (element: HTMLElement) => void;
  write: (data: string) => void;
  onData: (listener: (data: string) => void) => Readonly<{ dispose: () => void }>;
  fit: () => TerminalSize;
  focus: () => void;
  dispose: () => void;
}>;

export type TerminalPanelStateKind =
  | "unstarted"
  | "preparing"
  | "ready"
  | "exited"
  | "failed";

export type TerminalPanelProps = Readonly<{
  files: ProjectFiles;
  visibleFiles: readonly string[];
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  loadTerminalView?: () => Promise<TerminalView>;
  onTypeFiles: (files: ProjectFiles) => void;
  onWorkspaceChange: (change: WorkspaceChange) => void;
  onSessionChange: (session: TerminalSession | undefined) => void;
  onStateChange: (state: TerminalPanelStateKind) => void;
}>;
```

`createXtermView()`は`@xterm/xterm`と`@xterm/addon-fit`を動的importし、`screenReaderMode: true`でTerminalを生成します。起動中の出力はrefへ蓄積し、端末DOMを開いた直後に書き込みます。`ResizeObserver`から`fit()`と`session.resize()`を呼びます。

`SessionCodePlayground.astro`では`@xterm/xterm/css/xterm.css`を読み込みます。

- [ ] **Step 5: TerminalPanelテストを再実行して成功を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/TerminalPanel.test.tsx`

Expected: PASSします。

- [ ] **Step 6: ターミナル表示をコミットする**

```bash
git add apps/docs/package.json pnpm-lock.yaml apps/docs/src/components/code-explorer/TerminalPanel.tsx apps/docs/src/components/code-explorer/TerminalPanel.test.tsx apps/docs/src/components/code-explorer/SessionCodePlayground.astro
git commit -m "feat(docs): xterm.jsの対話ターミナルを追加"
```

---

### Task 4: CodeExplorerを双方向同期へ接続して固定実行UIを削除

**Files:**
- Modify: `apps/docs/src/components/code-explorer/CodeExplorer.tsx`
- Modify: `apps/docs/src/components/code-explorer/CodeExplorer.test.tsx`
- Modify: `apps/docs/src/components/code-explorer/FileTree.tsx`
- Delete: `apps/docs/src/components/code-explorer/OutputPanel.tsx`
- Delete: `apps/docs/src/code-explorer/run-command.ts`

**Interfaces:**
- Consumes: `reduceWorkspaceState`, `TerminalPanel`, `TerminalSession`, `WorkspaceChange`
- Produces: 編集・リセット・監視イベントを同じ`WorkspaceState`へ集約した`CodeExplorer`

- [ ] **Step 1: CodeExplorerの新しい受け入れテストへ書き換える**

```tsx
expect(host.querySelector('[data-action="run"]')).toBeNull();
expect(host.querySelector('[data-action="stop"]')).toBeNull();
expect(host.querySelector('[aria-label="実行結果"]')).toBeNull();
expect(host.querySelector('[data-action="start-terminal"]')).not.toBeNull();
```

モックセッションを起動した後、次を検証します。

- エディタ変更とリセットが`session.writeFile(path, contents)`へ渡ること
- 監視の`write`で新規ファイルがツリーに現れ、選択して編集できること
- 新規ファイル選択時にリセットが無効になること
- 監視の`delete`でツリーから消え、選択が残存ファイルへ移ること
- 準備中だけツリー、エディタ、リセットを無効にし、`ready`ではコマンド実行中でも編集できること
- 読み取り専用ガイドではTerminalPanelもランナーも生成しないこと
- 型定義通知がMonacoへ渡ること

- [ ] **Step 2: CodeExplorerテストを実行して失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/CodeExplorer.test.tsx`

Expected: 固定実行UIが残り、ターミナルと同期処理がないためFAILします。

- [ ] **Step 3: useReducerとTerminalPanelを接続する**

```tsx
const [workspaceState, dispatch] = useReducer(
  reduceWorkspaceState,
  undefined,
  () => createWorkspaceState(projectFiles, workspace.visibleFiles, initialPath),
);
const terminalSession = useRef<TerminalSession>();

const changeFile = (path: string, contents: string) => {
  dispatch({ kind: "edit", path, contents });
  void terminalSession.current?.writeFile(path, contents);
};
```

`TerminalPanel`の`onWorkspaceChange`は`external-write`または`external-delete`へ変換します。`FileTree.paths`には動的な`visiblePaths`を渡します。`selectedPath`がない場合は「表示できるファイルがありません。」を表示します。

固定のrun/stop/output状態、`OutputPanel`、`run-command`参照をすべて削除します。リセットボタンは初期ファイルだけ有効にし、準備中は編集操作を無効にします。

- [ ] **Step 4: CodeExplorerと関連テストを再実行する**

Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/components/code-explorer/CodeExplorer.test.tsx src/code-explorer/workspace-state.test.ts src/code-explorer/runner.test.ts src/components/code-explorer/TerminalPanel.test.tsx`

Expected: PASSします。

- [ ] **Step 5: 固定実行UIの廃止と同期接続をコミットする**

```bash
git add apps/docs/src/components/code-explorer/CodeExplorer.tsx apps/docs/src/components/code-explorer/CodeExplorer.test.tsx apps/docs/src/components/code-explorer/FileTree.tsx apps/docs/src/components/code-explorer/OutputPanel.tsx apps/docs/src/code-explorer/run-command.ts
git commit -m "feat(docs): エディタとターミナルのファイル変更を同期"
```

---

### Task 5: ターミナル配置、案内文、ブラウザテストを更新

**Files:**
- Modify: `apps/docs/src/styles/code-playground.css`
- Modify: `apps/docs/src/components/code-explorer/SessionCodePlayground.astro`
- Modify: `apps/docs/e2e/session-code-playground.spec.ts`

**Interfaces:**
- Consumes: `TerminalPanel`が出力する`code-explorer__terminal`系クラスと`data-action`属性
- Produces: デスクトップ・モバイル双方の全幅ターミナル配置と実ブラウザ受け入れテスト

- [ ] **Step 1: Playwrightの期待値をターミナルUIへ変更する**

```ts
await expect(playground.locator('[data-action="run"]')).toHaveCount(0);
await expect(playground.locator('[data-action="stop"]')).toHaveCount(0);
await expect(playground.locator('[aria-label="実行結果"]')).toHaveCount(0);
await expect(
  playground.getByRole("button", { name: "ターミナルを起動" }),
).toBeVisible();
```

セッション02の専用テストではターミナルを起動し、`pwd`の結果に`/workspace`が含まれることを確認します。続けて`printf`で`src/created.ts`を作成し、`[data-path="src/created.ts"]`が現れることを確認します。

- [ ] **Step 2: 対象Playwrightテストを実行して失敗を確認する**

Run: `pnpm --filter @fp-with-ts/docs test:visual -- e2e/session-code-playground.spec.ts --project=chromium`

Expected: 起動ボタンとターミナルがないためFAILします。

- [ ] **Step 3: CSSと案内文を更新する**

```css
.code-playground .code-explorer__terminal {
  width: 100%;
  min-width: 0;
  margin-top: 0.75rem;
}

.code-playground .code-explorer__terminal-screen {
  min-height: 18rem;
  padding: 0.5rem;
  overflow: hidden;
  background: var(--playground-code);
}
```

起動前・準備中・失敗・終了のパネルも既存のハードボーダーとフォーカス表現に合わせます。モバイルでは端末の最小高さを`15rem`へ下げます。案内文は「編集して、ターミナルから任意のコマンドで確認できます。」へ変更します。

- [ ] **Step 4: Playwrightテストを再実行して成功を確認する**

Run: `pnpm --filter @fp-with-ts/docs test:visual -- e2e/session-code-playground.spec.ts --project=chromium`

Expected: PASSします。

- [ ] **Step 5: UIとブラウザテストをコミットする**

```bash
git add apps/docs/src/styles/code-playground.css apps/docs/src/components/code-explorer/SessionCodePlayground.astro apps/docs/e2e/session-code-playground.spec.ts
git commit -m "feat(docs): ターミナルを全幅で配置して実操作を検証"
```

---

### Task 6: 全体検証とDraft PR更新

**Files:**
- Verify only
- Modify: Draft PR #84 description when the implementation summary changes

**Interfaces:**
- Consumes: Tasks 1〜5の全変更
- Produces: レビュー可能なコミット列と検証結果を含むDraft PR

- [ ] **Step 1: 廃止対象の参照が残っていないことを確認する**

Run: `rg -n 'run-command|OutputPanel|data-action="run"|data-action="stop"|aria-label="実行結果"' apps/docs/src apps/docs/e2e`

Expected: 新UIで不在を検証するテスト以外にヒットしません。

- [ ] **Step 2: Docsの単体テストと型検査を実行する**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASSします。

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASSします。

- [ ] **Step 3: Docsのビルドと全ブラウザテストを実行する**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASSします。

Run: `pnpm --filter @fp-with-ts/docs test:visual`

Expected: PASSします。

- [ ] **Step 4: 実ブラウザで教材コマンドを確認する**

開発サーバーを`0.0.0.0`で起動し、セッション02のターミナルで`pnpm exercise:02`を実行します。教材で意図した業務名のassertion failureが表示され、セッション全体がエラー状態にならないことを確認します。

- [ ] **Step 5: 差分とコミットを確認する**

Run: `git diff --check origin/main...HEAD`

Expected: 出力なしで終了コード0になります。

Run: `git status --short --branch`

Expected: 作業ツリーがクリーンで、featureブランチがremoteより先行しています。

- [ ] **Step 6: pushして既存Draft PRを更新する**

Run: `git push origin codex/fix-playground-layout-density`

Expected: リモートブランチが最新コミットへ進みます。

Run: `gh pr edit 84 --body-file <更新済みPR本文ファイル>`

Expected: Draft PR #84にターミナル化の内容と検証結果が記載されます。
