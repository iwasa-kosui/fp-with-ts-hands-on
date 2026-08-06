# Module Code Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file-tree code editor to every `apps/docs` module page so a participant can edit the module's real clinic-example files and run exactly one selected test or TypeScript entrypoint in a browser WebContainer.

**Architecture:** Astro imports `packages/clinic-example` as raw build-time project data and selects a learning-focused visible subset through a module workspace catalog. A React island owns file selection, edits, execution state, and output; Monaco supplies the editor, while a narrow runner adapter lazily boots one WebContainer, installs dependencies once, synchronizes all edited files, and spawns a fixed argument array for the selected file.

**Tech Stack:** Astro 4, React 18, TypeScript, Vitest 2, Monaco Editor 0.56.0, WebContainer API 1.6.4, tsx 4.23.9, Cloudflare Workers Static Assets

## Global Constraints

- Support current desktop Chrome and Edge; Safari and Firefox are outside the supported acceptance target.
- Keep Astro static output and Cloudflare Workers Static Assets; do not add SSR or server-side code execution.
- Run edited code only inside the participant's browser and never send it to the Worker.
- Execute exactly one selected file: `exercises/*.test.ts` with the exercise Vitest config, `test/*.test.ts` with the normal Vitest config, and any other `.ts` file with `tsx`.
- Preserve edits only in React memory for the current page lifetime; do not add localStorage, URL sharing, or server persistence.
- Preserve existing module prose, authored `article h2` outlines, page TOCs, navigation, health check, and compatibility redirect.
- Treat `packages/clinic-example` as the only source of initial code; do not copy hand-maintained source strings into docs.
- Use one WebContainer instance per page and initialize it only after the first Run action.
- Render terminal output as text. WebContainer combines stdout and stderr into one ordered output stream.
- Serve `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` in local development, preview, and deployed module pages.

---

### Task 1: Collect the real clinic project and define module workspaces

**Files:**
- Create: `apps/docs/src/code-explorer/types.ts`
- Create: `apps/docs/src/code-explorer/project-files.ts`
- Create: `apps/docs/src/code-explorer/module-workspaces.ts`
- Test: `apps/docs/src/code-explorer/module-workspaces.test.ts`

**Interfaces:**
- Produces: `ProjectFiles = Readonly<Record<string, string>>`
- Produces: `ModuleWorkspace = Readonly<{ slug: string; description: string; initialFile: string; visibleFiles: readonly string[] }>`
- Produces: `projectFiles: ProjectFiles`
- Produces: `moduleWorkspaceFor(slug: string): ModuleWorkspace`
- Consumed later by: Astro integration, React explorer, WebContainer runner

- [ ] **Step 1: Write the failing workspace contract test**

Name the breaks: a module can lose its exercise or source file, select a missing initial file, or refer to a path that no longer exists in the real package.

```ts
import { describe, expect, it } from "vitest";
import { modules } from "../modules/catalog";
import { moduleWorkspaceFor } from "./module-workspaces";
import { projectFiles } from "./project-files";

const requiredFiles = {
  "00-break-the-app": [
    "src/legacy/appointment.ts",
    "src/legacy/logger.ts",
    "exercises/00-incident.test.ts",
    "test/00-setup.test.ts",
  ],
  "00-read-the-incident": [
    "src/legacy/appointment.ts",
    "src/clinic/appointment.ts",
    "exercises/01-state-modeling.test.ts",
    "test/01-state-modeling.test.ts",
  ],
  "01-state-modeling": [
    "src/clinic/appointment.ts",
    "src/clinic/appointment-id.ts",
    "src/clinic/pet-id.ts",
    "src/clinic/veterinarian-id.ts",
    "exercises/01-state-modeling.test.ts",
    "test/01-state-modeling.test.ts",
  ],
  "02-boundary-and-ids": [
    "src/clinic/exam-result.ts",
    "src/clinic/owner-contact.ts",
    "src/clinic/owner-id.ts",
    "src/clinic/pet-id.ts",
    "src/shared/sensitive.ts",
    "exercises/02-boundary-and-ids.test.ts",
    "test/02-boundary-and-ids.test.ts",
  ],
  "03-result-errors": [
    "src/clinic/use-cases.ts",
    "src/clinic/appointment-repository.ts",
    "src/clinic/domain-event-store.ts",
    "src/clinic/domain-events.ts",
    "src/shared/result.ts",
    "exercises/03-result-errors.test.ts",
    "test/03-result-errors.test.ts",
  ],
  "04-agent-review": [
    "src/clinic/agent-review.ts",
    "exercises/04-agent-review.test.ts",
    "test/04-agent-review.test.ts",
  ],
  "05-mini-integration": [
    "src/clinic/use-cases.ts",
    "src/clinic/exam-result.ts",
    "src/clinic/owner-contact.ts",
    "src/shared/sensitive.ts",
    "exercises/05-follow-up.test.ts",
    "test/05-follow-up.test.ts",
  ],
} as const;

describe("module code workspaces", () => {
  it("covers every catalog module with real, unique visible files", () => {
    for (const module of modules) {
      const workspace = moduleWorkspaceFor(module.slug);
      expect(workspace.visibleFiles).toEqual(
        expect.arrayContaining([...requiredFiles[module.slug]]),
      );
      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(workspace.visibleFiles.length);
      for (const path of workspace.visibleFiles) {
        expect(projectFiles[path], `${module.slug}: ${path}`).toEqual(expect.any(String));
      }
    }
  });

  it("rejects an unknown module slug", () => {
    expect(() => moduleWorkspaceFor("not-a-module")).toThrow(
      "Unknown module workspace: not-a-module",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @fp-with-ts/docs test -- src/code-explorer/module-workspaces.test.ts`

Expected: FAIL because `./module-workspaces` and `./project-files` do not exist.

- [ ] **Step 3: Add the serializable workspace types**

```ts
export type ProjectFiles = Readonly<Record<string, string>>;

export type ModuleWorkspace = Readonly<{
  slug: string;
  description: string;
  initialFile: string;
  visibleFiles: readonly string[];
}>;
```

- [ ] **Step 4: Collect the project through raw Vite imports**

Implement `project-files.ts` with a static glob and direct raw imports. Normalize every glob key by removing `../../../../packages/clinic-example/`. Parse the raw package manifest and add `tsx: "4.23.9"` to `devDependencies` before serializing it.

```ts
import packageJsonSource from "../../../../packages/clinic-example/package.json?raw";
import tsconfigSource from "../../../../packages/clinic-example/tsconfig.json?raw";
import vitestConfigSource from "../../../../packages/clinic-example/vitest.config.ts?raw";
import exerciseConfigSource from "../../../../packages/clinic-example/vitest.exercises.config.ts?raw";
import type { ProjectFiles } from "./types";

const packageSources = import.meta.glob(
  "../../../../packages/clinic-example/{src,exercises,test}/**/*.ts",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const packagePrefix = "../../../../packages/clinic-example/";
const packageJson = JSON.parse(packageJsonSource) as {
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export const projectFiles: ProjectFiles = Object.freeze({
  ...Object.fromEntries(
    Object.entries(packageSources).map(([path, source]) => [
      path.replace(packagePrefix, ""),
      source,
    ]),
  ),
  "package.json": JSON.stringify(
    {
      ...packageJson,
      devDependencies: { ...packageJson.devDependencies, tsx: "4.23.9" },
    },
    null,
    2,
  ),
  "tsconfig.json": tsconfigSource,
  "vitest.config.ts": vitestConfigSource,
  "vitest.exercises.config.ts": exerciseConfigSource,
});
```

- [ ] **Step 5: Define every module's exact visible set and initial test**

Implement `module-workspaces.ts` as a readonly record. Use these initial files:

```ts
const moduleWorkspaces = {
  "00-break-the-app": {
    initialFile: "exercises/00-incident.test.ts",
    description: "事故を再現するテストとlegacy実装を編集して実行します。",
    visibleFiles: [
      "exercises/00-incident.test.ts",
      "test/00-setup.test.ts",
      "src/legacy/appointment.ts",
      "src/legacy/logger.ts",
    ],
  },
  "00-read-the-incident": {
    initialFile: "exercises/01-state-modeling.test.ts",
    description: "追加要求を表すテストと移行前後の状態モデルを比較します。",
    visibleFiles: [
      "exercises/01-state-modeling.test.ts",
      "test/01-state-modeling.test.ts",
      "src/legacy/appointment.ts",
      "src/legacy/logger.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
    ],
  },
  "01-state-modeling": {
    initialFile: "exercises/01-state-modeling.test.ts",
    description: "状態遷移の実装と型・実行時テストを編集して実行します。",
    visibleFiles: [
      "exercises/01-state-modeling.test.ts",
      "test/01-state-modeling.test.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
    ],
  },
  "02-boundary-and-ids": {
    initialFile: "exercises/02-boundary-and-ids.test.ts",
    description: "入力境界、ID、PII保護のコードとテストを編集して実行します。",
    visibleFiles: [
      "exercises/02-boundary-and-ids.test.ts",
      "test/02-boundary-and-ids.test.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/owner-id.ts",
      "src/clinic/pet-id.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "03-result-errors": {
    initialFile: "exercises/03-result-errors.test.ts",
    description: "Resultと成功イベントのuse caseとテストを編集して実行します。",
    visibleFiles: [
      "exercises/03-result-errors.test.ts",
      "test/03-result-errors.test.ts",
      "src/clinic/use-cases.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/appointment-repository.ts",
      "src/clinic/domain-event-store.ts",
      "src/clinic/domain-events.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
      "src/shared/result.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "04-agent-review": {
    initialFile: "exercises/04-agent-review.test.ts",
    description: "レビュー観点とエージェント依頼の生成テストを編集して実行します。",
    visibleFiles: [
      "exercises/04-agent-review.test.ts",
      "test/04-agent-review.test.ts",
      "src/clinic/agent-review.ts",
    ],
  },
  "05-mini-integration": {
    initialFile: "exercises/05-follow-up.test.ts",
    description: "電話フォローuse caseと統合テストを編集して実行します。",
    visibleFiles: [
      "exercises/05-follow-up.test.ts",
      "test/05-follow-up.test.ts",
      "src/clinic/use-cases.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/appointment-repository.ts",
      "src/clinic/domain-event-store.ts",
      "src/clinic/domain-events.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
      "src/shared/result.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
} as const;
```

Return an immutable copy with the requested `slug`, and throw `new Error(`Unknown module workspace: ${slug}`)` when the record has no matching key.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `pnpm --filter @fp-with-ts/docs test -- src/code-explorer/module-workspaces.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/docs/src/code-explorer
git commit -m "feat(docs): catalog module code workspaces"
```

---

### Task 2: Build the single-file WebContainer runner

**Files:**
- Modify: `apps/docs/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/docs/src/code-explorer/run-command.ts`
- Create: `apps/docs/src/code-explorer/runner.ts`
- Test: `apps/docs/src/code-explorer/runner.test.ts`

**Interfaces:**
- Consumes: `ProjectFiles`
- Produces: `runCommandFor(path: string): RunCommand | undefined`
- Produces: `CodeRunner.run(request, onUpdate): Promise<RunResult>`
- Produces: `createWebContainerRunner(): CodeRunner`
- Produces updates: phase, combined terminal output, and external declaration files

- [ ] **Step 1: Write failing command-selection and lifecycle tests**

Name the breaks: an exercise can run under the wrong config, the runner can execute more than one file, install can repeat, or edits can fail to reach the runtime.

```ts
import { describe, expect, it } from "vitest";
import { runCommandFor } from "./run-command";
import { createCodeRunner, type Runtime } from "./runner";

const createInMemoryRuntime = (): Runtime &
  Readonly<{
    files: Map<string, string>;
    installCount: number;
    executedFiles: readonly string[];
  }> => {
  const files = new Map<string, string>();
  const executedFiles: string[] = [];
  let installCount = 0;
  return {
    files,
    executedFiles,
    get installCount() {
      return installCount;
    },
    mount: async (mounted) => {
      for (const [path, source] of Object.entries(mounted)) files.set(`/${path}`, source);
    },
    install: async (onOutput) => {
      installCount += 1;
      onOutput("installed\n");
      return 0;
    },
    writeFiles: async (edited) => {
      for (const [path, source] of Object.entries(edited)) files.set(`/${path}`, source);
    },
    execute: async (command, onOutput) => {
      const selected = [...command.args].reverse().find((arg) => arg.endsWith(".ts"));
      if (selected !== undefined) executedFiles.push(selected);
      onOutput("ok\n");
      return 0;
    },
    readTypeFiles: async () => ({}),
  };
};

describe("single-file execution", () => {
  it("selects one fixed command by file kind", () => {
    expect(runCommandFor("exercises/02-boundary-and-ids.test.ts")).toEqual({
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.exercises.config.ts",
        "exercises/02-boundary-and-ids.test.ts",
        "--reporter=verbose",
      ],
    });
    expect(runCommandFor("test/02-boundary-and-ids.test.ts")).toEqual({
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.config.ts",
        "test/02-boundary-and-ids.test.ts",
        "--reporter=verbose",
      ],
    });
    expect(runCommandFor("src/clinic/appointment.ts")).toEqual({
      command: "npx",
      args: ["--no-install", "tsx", "src/clinic/appointment.ts"],
    });
    expect(runCommandFor("package.json")).toBeUndefined();
  });

  it("installs once and writes the latest edits before each run", async () => {
    const runtime = createInMemoryRuntime();
    const runner = createCodeRunner(async () => runtime);
    const updates: string[] = [];

    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('first')", "package.json": "{}" },
      },
      (update) => {
        if (update.kind === "phase") updates.push(update.phase);
      },
    );
    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('second')", "package.json": "{}" },
      },
      () => undefined,
    );

    expect(runtime.installCount).toBe(1);
    expect(runtime.files.get("/src/main.ts")).toBe("console.log('second')");
    expect(runtime.executedFiles).toEqual(["src/main.ts", "src/main.ts"]);
    expect(updates).toEqual(["booting", "mounting", "installing", "running"]);
  });
});
```

Keep `createInMemoryRuntime()` in the test file rather than production.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @fp-with-ts/docs test -- src/code-explorer/runner.test.ts`

Expected: FAIL because `run-command.ts` and `runner.ts` do not exist.

- [ ] **Step 3: Install the exact browser runtime dependencies**

Run:

```bash
pnpm --filter @fp-with-ts/docs add @webcontainer/api@1.6.4 monaco-editor@0.56.0
```

Do not install `tsx` in `apps/docs`; it belongs only in the mounted runtime manifest assembled in Task 1.

- [ ] **Step 4: Implement pure command selection without shell interpolation**

```ts
export type RunCommand = Readonly<{ command: string; args: readonly string[] }>;

export const runCommandFor = (path: string): RunCommand | undefined => {
  if (/^exercises\/.+\.test\.ts$/.test(path)) {
    return {
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.exercises.config.ts",
        path,
        "--reporter=verbose",
      ],
    };
  }
  if (/^test\/.+\.test\.ts$/.test(path)) {
    return {
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.config.ts",
        path,
        "--reporter=verbose",
      ],
    };
  }
  return path.endsWith(".ts")
    ? { command: "npx", args: ["--no-install", "tsx", path] }
    : undefined;
};
```

- [ ] **Step 5: Implement a narrow runner interface and filesystem tree builder**

Use discriminated updates:

```ts
export type RunnerPhase = "booting" | "mounting" | "installing" | "running";
export type RunnerUpdate =
  | Readonly<{ kind: "phase"; phase: RunnerPhase }>
  | Readonly<{ kind: "output"; chunk: string }>
  | Readonly<{ kind: "type-files"; files: ProjectFiles }>;
export type RunRequest = Readonly<{ filePath: string; files: ProjectFiles }>;
export type RunResult = Readonly<{ exitCode: number }>;
export type Runtime = Readonly<{
  mount: (files: ProjectFiles) => Promise<void>;
  install: (onOutput: (chunk: string) => void) => Promise<number>;
  writeFiles: (files: ProjectFiles) => Promise<void>;
  execute: (
    command: RunCommand,
    onOutput: (chunk: string) => void,
  ) => Promise<number>;
  readTypeFiles: () => Promise<ProjectFiles>;
}>;
export type CodeRunner = Readonly<{
  run: (
    request: RunRequest,
    onUpdate: (update: RunnerUpdate) => void,
  ) => Promise<RunResult>;
}>;
```

The production WebContainer runtime adapter converts flat paths such as `src/clinic/appointment.ts` into nested WebContainer `FileSystemTree` nodes. The tree builder must reject empty path segments and duplicate file/directory collisions.

- [ ] **Step 6: Implement lazy boot, one-time install, edit synchronization, and output streaming**

`createCodeRunner(loadRuntime)` owns one `runtimePromise` and one `installPromise`. The first run emits `booting`, `mounting`, and `installing`; later runs skip those phases. Every run writes every current file before spawning.

Treat a nonzero install exit as an error and clear the cached install promise so the next Run action can retry installation. Likewise, clear a rejected runtime promise so a failed boot does not permanently poison the page. Do not execute the selected file unless installation completed successfully.

The WebContainer runtime adapter spawns with an argument array and `NO_COLOR`:

```ts
const process = await runtime.spawn(command.command, [...command.args], {
  env: { NO_COLOR: "1", FORCE_COLOR: "0" },
});
const output = process.output.pipeTo(
  new WritableStream({
    write: (chunk) => onUpdate({ kind: "output", chunk }),
  }),
);
const [exitCode] = await Promise.all([process.exit, output]);
return { exitCode };
```

After install, recursively read `.d.ts` and `package.json` files beneath `node_modules/zod`, `node_modules/vitest`, and `node_modules/@vitest` using `fs.readdir(..., { withFileTypes: true })`. Emit them once as `type-files` with `file:///node_modules/...`-compatible paths so Monaco can resolve imported package declarations.

Production `createWebContainerRunner()` dynamically imports `@webcontainer/api`, calls `WebContainer.boot()`, and adapts the result to the narrow runtime interface. Do not import or boot WebContainers at module evaluation time.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `pnpm --filter @fp-with-ts/docs test -- src/code-explorer/runner.test.ts`

Expected: PASS for command selection, one-time installation, edited file synchronization, and combined output forwarding.

- [ ] **Step 8: Commit Task 2**

```bash
git add apps/docs/package.json apps/docs/src/code-explorer pnpm-lock.yaml
git commit -m "feat(docs): add browser code runner"
```

---

### Task 3: Implement the accessible file tree, editor state, reset, and output UI

**Files:**
- Create: `apps/docs/src/components/code-explorer/FileTree.tsx`
- Create: `apps/docs/src/components/code-explorer/OutputPanel.tsx`
- Create: `apps/docs/src/components/code-explorer/CodeExplorer.tsx`
- Test: `apps/docs/src/components/code-explorer/CodeExplorer.test.tsx`

**Interfaces:**
- Consumes: `ModuleWorkspace`, `ProjectFiles`, `CodeRunner`
- Produces: `CodeExplorer` React island
- Produces: `EditorProps = { path; value; files; typeFiles; disabled; onChange }`
- Consumed later by: `MonacoEditor`, `ModuleCodeExplorer.astro`

- [ ] **Step 1: Write failing real-state UI tests with a test editor and runner boundary**

Name the breaks: switching files can discard edits, reset can affect the wrong file, Run can send stale content, and a failed execution can leave the UI locked.

```tsx
import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../../code-explorer/runner";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";

const TestEditor: ComponentType<EditorProps> = ({ value, disabled, onChange }) => (
  <textarea
    aria-label="コードエディタ"
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const workspace = {
  slug: "01-state-modeling",
  description: "状態を編集します。",
  initialFile: "exercises/example.test.ts",
  visibleFiles: ["exercises/example.test.ts", "src/example.ts"],
} as const;

const files = {
  "exercises/example.test.ts": "expect(value).toBe(1);",
  "src/example.ts": "export const value = 1;",
  "package.json": "{}",
} as const;

describe("CodeExplorer", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("keeps edits across file switches and resets only the selected file", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(
      <CodeExplorer
        workspace={workspace}
        projectFiles={files}
        Editor={TestEditor}
        supportsRuntime={() => true}
      />,
    ));

    await act(async () => host.querySelector<HTMLButtonElement>('[data-path="src/example.ts"]')?.click());
    const editor = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="コードエディタ"]')!;
    await act(async () => {
      editor.value = "export const value = 2;";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-path="exercises/example.test.ts"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-path="src/example.ts"]')?.click());

    expect(host.querySelector("textarea")?.value).toBe("export const value = 2;");
    expect(host.querySelector('[data-path="src/example.ts"]')?.textContent).toContain("変更あり");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-action="reset"]')?.click());
    expect(host.querySelector("textarea")?.value).toBe("export const value = 1;");
  });

  it("runs the selected file with every current edit and renders streamed output", async () => {
    let receivedFiles: Readonly<Record<string, string>> = {};
    const runner = {
      run: async (request, onUpdate) => {
        receivedFiles = request.files;
        onUpdate({ kind: "phase", phase: "running" });
        onUpdate({ kind: "output", chunk: "1 test passed\n" });
        return { exitCode: 0 };
      },
    } satisfies CodeRunner;

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(
      <CodeExplorer
        workspace={workspace}
        projectFiles={files}
        Editor={TestEditor}
        runnerFactory={() => runner}
        supportsRuntime={() => true}
      />,
    ));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-action="run"]')?.click());

    expect(receivedFiles["src/example.ts"]).toBe("export const value = 1;");
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain("1 test passed");
    expect(host.textContent).toContain("終了コード 0");
  });
});
```

Unmount each React root in `afterEach` or at the end of each test to avoid leaking effects.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/CodeExplorer.test.tsx`

Expected: FAIL because the code explorer components do not exist.

- [ ] **Step 3: Implement the file tree as semantic nested lists**

Split each visible path on `/`, create stable directory nodes, and render folders as labels with nested `<ul>` elements. Render each file as a button with:

```tsx
<button
  type="button"
  data-path={path}
  aria-pressed={path === selectedPath}
  onClick={() => onSelect(path)}
>
  <span>{fileName}</span>
  {dirty ? <span className="code-explorer__dirty">変更あり</span> : null}
</button>
```

Use `nav aria-label="教材ファイル"`. Keep folders expanded in the first version so keyboard users can Tab directly through every file.

- [ ] **Step 4: Implement the output state panel**

Use a discriminated state:

```ts
type ExecutionState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "working"; label: string; output: string }>
  | Readonly<{ kind: "finished"; output: string; exitCode: number }>
  | Readonly<{ kind: "error"; output: string; message: string }>;
```

Render output in `<pre>` inside a region with `aria-live="polite"`. Render strings through React text children only. A nonzero exit code uses the failure treatment even when the output contains no error text.

- [ ] **Step 5: Implement explorer state and injected boundaries**

`CodeExplorer` initializes a content record from `projectFiles`. It derives dirty state by comparing the current string with `projectFiles[path]`. Keep the selected path in state, the runner instance in a ref, and the latest external type files in state.

Default optional boundaries:

```ts
const defaultSupportsRuntime = (): boolean =>
  globalThis.crossOriginIsolated === true && typeof WebAssembly !== "undefined";

const defaultRunnerFactory = (): CodeRunner => createWebContainerRunner();
```

On Run:

1. Reject unsupported runtime with the Japanese message `ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。`.
2. Clear old output and disable editing, reset, file selection, and Run.
3. Call `runner.run({ filePath: selectedPath, files: contents }, onUpdate)`.
4. Append output chunks in arrival order.
5. Store external type files from `type-files` updates.
6. Re-enable controls in `finally`.

- [ ] **Step 6: Run focused UI tests and verify GREEN**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/CodeExplorer.test.tsx`

Expected: PASS for edit persistence, dirty state, single-file reset, current file synchronization, output, and exit status.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/docs/src/components/code-explorer
git commit -m "feat(docs): add code explorer interface"
```

---

### Task 4: Integrate Monaco with SSR fallback and project models

**Files:**
- Create: `apps/docs/src/components/code-explorer/MonacoEditor.tsx`
- Create: `apps/docs/src/components/code-explorer/monaco-client.ts`
- Test: `apps/docs/src/components/code-explorer/MonacoEditor.test.tsx`
- Modify: `apps/docs/src/env.d.ts`

**Interfaces:**
- Consumes: `EditorProps` from `CodeExplorer.tsx`
- Produces: `MonacoEditor` default editor implementation
- Produces: `modelUriFor(path: string): string`

- [ ] **Step 1: Write a failing SSR fallback and URI test**

Name the breaks: server rendering can produce an empty editor and Monaco models can use URIs that prevent relative import resolution.

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonacoEditor, modelUriFor } from "./MonacoEditor";

describe("MonacoEditor", () => {
  it("renders readable source before browser hydration", () => {
    const html = renderToString(
      <MonacoEditor
        path="src/clinic/appointment.ts"
        value={'export const kind = "Scheduled";'}
        files={{ "src/clinic/appointment.ts": 'export const kind = "Scheduled";' }}
        typeFiles={{}}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain("src/clinic/appointment.ts");
    expect(html).toContain("export const kind");
  });

  it("uses absolute file URIs for project-relative paths", () => {
    expect(modelUriFor("src/clinic/appointment.ts")).toBe(
      "file:///src/clinic/appointment.ts",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/MonacoEditor.test.tsx`

Expected: FAIL because `MonacoEditor.tsx` does not exist.

- [ ] **Step 3: Add client-only Monaco worker wiring**

In `monaco-client.ts`, import editor and TypeScript workers with Vite `?worker`, then assign `globalThis.MonacoEnvironment.getWorker`:

```ts
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

globalThis.MonacoEnvironment = {
  getWorker: (_moduleId, label) =>
    label === "typescript" || label === "javascript"
      ? new tsWorker()
      : new editorWorker(),
};

export { monaco };
```

Extend `env.d.ts` only with the narrow `MonacoEnvironment` global type required by this assignment. Do not add broad `any` declarations.

- [ ] **Step 4: Implement SSR fallback, one model per file, and model switching**

`MonacoEditor.tsx` initially renders a labeled fallback `<pre>`. In `useEffect`, dynamically import `./monaco-client`, configure strict TypeScript compiler options with NodeJs module resolution, create a model for every `.ts` file using `file:///${path}`, and create the editor on the selected model.

When `path` changes, call `editor.setModel(models.get(path))`. When a reset or external state update changes a model's value, call `model.setValue(value)` only if it differs. Subscribe to the selected model and call `onChange(editor.getValue())` for user edits. Set `readOnly` from `disabled`.

Register every dependency declaration received through `typeFiles`:

```ts
for (const [path, source] of Object.entries(typeFiles)) {
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    source,
    path.startsWith("file:///") ? path : `file:///${path}`,
  );
}
```

Dispose the editor, subscriptions, local models, and extra-lib disposables on unmount. Do not dispose models owned by another component instance.

- [ ] **Step 5: Use Monaco as the production default**

Import `MonacoEditor` in `CodeExplorer.tsx` and use it when the optional `Editor` test boundary is absent. Keep the test editor injection so happy-dom tests do not initialize workers.

- [ ] **Step 6: Run component tests and verify GREEN**

Run:

```bash
pnpm --filter @fp-with-ts/docs test -- src/components/code-explorer/MonacoEditor.test.tsx src/components/code-explorer/CodeExplorer.test.tsx
```

Expected: PASS for SSR fallback, model URI, and all explorer state behavior.

- [ ] **Step 7: Run docs typecheck before committing**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: PASS with no Astro or TypeScript errors.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/docs/src/components/code-explorer apps/docs/src/env.d.ts
git commit -m "feat(docs): embed Monaco code editor"
```

---

### Task 5: Add the explorer to every module and configure isolated delivery

**Files:**
- Create: `apps/docs/src/components/code-explorer/ModuleCodeExplorer.astro`
- Modify: `apps/docs/src/layouts/ModuleLayout.astro`
- Modify: `apps/docs/src/styles/modules.css`
- Modify: `apps/docs/src/test/pages/site-contract.test.ts`
- Modify: `apps/docs/src/test/layouts/ModuleLayout.test.ts`
- Modify: `apps/docs/scripts/verify-static-build.mjs`
- Modify: `apps/docs/astro.config.ts`
- Create: `apps/docs/public/_headers`

**Interfaces:**
- Consumes: `module.slug`, `moduleWorkspaceFor`, `projectFiles`, `CodeExplorer`
- Produces: one SSR + hydrated explorer per module page
- Produces: COOP/COEP headers in Vite dev, Vite preview, and Cloudflare static assets

- [ ] **Step 1: Write the failing all-pages integration test**

Name the breaks: a new or existing module page can omit the explorer, use the wrong initial file, or insert the explorer into the authored article outline.

Add to `site-contract.test.ts`:

```ts
const authoredModulePages = import.meta.glob<{ default: unknown }>(
  "../../pages/modules/*.astro",
  { eager: true },
);

it("renders one module-specific code explorer outside every article", async () => {
  const container = await createAstroContainer();
  for (const module of modules) {
    const page = authoredModulePages[`../../pages/modules/${module.slug}.astro`]?.default;
    expect(page, module.slug).toBeDefined();
    const html = await container.renderToString(page as never, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");
    const explorers = document.querySelectorAll('[data-code-explorer]');
    expect(explorers, module.slug).toHaveLength(1);
    expect(document.querySelector("article [data-code-explorer]"), module.slug).toBeNull();
    expect(explorers[0]?.textContent, module.slug).toContain(
      moduleWorkspaceFor(module.slug).initialFile,
    );
  }
});
```

Import `moduleWorkspaceFor`. Reuse the existing `pageModules` glob rather than keeping two globs after the test is working.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/site-contract.test.ts`

Expected: FAIL because no module page renders `[data-code-explorer]`.

- [ ] **Step 3: Add the Astro bridge and layout section**

`ModuleCodeExplorer.astro` validates the slug and renders:

```astro
---
import { moduleWorkspaceFor } from "../../code-explorer/module-workspaces";
import { projectFiles } from "../../code-explorer/project-files";
import { CodeExplorer } from "./CodeExplorer";

interface Props { moduleSlug: string }
const workspace = moduleWorkspaceFor(Astro.props.moduleSlug);
---

<CodeExplorer client:load workspace={workspace} projectFiles={projectFiles} />
```

In `ModuleLayout.astro`, add a full-width section after `.case-file__body` and before module navigation:

```astro
<section class="case-file__playground" aria-labelledby="module-code-title">
  <p class="case-file__playground-eyebrow">BROWSER PLAYGROUND</p>
  <h2 id="module-code-title">コードを読んで実行する</h2>
  <p>ファイルを選び、編集してから、このファイルだけを実行できます。</p>
  <ModuleCodeExplorer moduleSlug={module.slug} />
</section>
```

The explorer root must render `data-code-explorer={workspace.slug}`. Keep this section outside the page-authored `<article>` so current h2 outline tests stay unchanged.

- [ ] **Step 4: Add responsive case-file styling**

Add a 74rem-wide playground section. At 768px and above, use a two-column top area (`14rem minmax(0, 1fr)`) and a full-width output panel below. Below 768px, stack tree, editor, and output. Use existing case variables, a dark editor/output surface, visible focus rings, 44px minimum touch targets, and `overflow: hidden` on the shell with internal scroll regions.

Use stable class prefixes:

```css
.case-file__playground {}
.code-explorer {}
.code-explorer__workspace {}
.code-explorer__tree {}
.code-explorer__editor {}
.code-explorer__toolbar {}
.code-explorer__output {}
.code-explorer__dirty {}
```

Do not add inline SVG icons. Use text labels and CSS indicators.

- [ ] **Step 5: Make static-build header verification fail first**

Before adding `_headers`, update `verify-static-build.mjs` to read `dist/_headers` and require these exact lines:

```js
const headers = await readFile(new URL("_headers", distUrl), "utf8");
for (const requiredHeader of [
  "/modules/*",
  "Cross-Origin-Embedder-Policy: require-corp",
  "Cross-Origin-Opener-Policy: same-origin",
]) {
  if (!headers.includes(requiredHeader)) {
    throw new Error(`Missing static asset header rule: ${requiredHeader}`);
  }
}
```

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: FAIL because `dist/_headers` does not exist.

- [ ] **Step 6: Add production, development, and preview headers**

Create `apps/docs/public/_headers`:

```text
/modules/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
```

Update `astro.config.ts`:

```ts
const isolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [react()],
  output: "static",
  outDir: "./dist",
  trailingSlash: "always",
  vite: {
    server: { headers: isolationHeaders },
    preview: { headers: isolationHeaders },
  },
});
```

Do not change `wrangler.jsonc` or route all assets through the Worker; Cloudflare applies `_headers` to asset-first responses.

- [ ] **Step 7: Run focused tests and the docs build**

Run:

```bash
pnpm --filter @fp-with-ts/docs test -- src/test/pages/site-contract.test.ts src/test/layouts/ModuleLayout.test.ts
pnpm --filter @fp-with-ts/docs build
```

Expected: page integration tests PASS; build PASS; verifier reports the existing HTML/route counts and accepts `dist/_headers`.

- [ ] **Step 8: Commit Task 5**

```bash
git add apps/docs
git commit -m "feat(docs): embed module code explorer"
```

---

### Task 6: Verify the complete implementation and Cloudflare response contract

**Files:**
- No planned file changes; any discovered defect returns to the task that owns the affected behavior

**Interfaces:**
- Verifies: docs UI contracts, code runner contracts, package tests, type safety, static build, Worker routes, and response headers

- [ ] **Step 1: Run all docs tests**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: all docs and Worker test files PASS with zero failures.

- [ ] **Step 2: Run the clinic-example tests**

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: all existing clinic tests PASS; no domain or exercise source was changed.

- [ ] **Step 3: Run repository typechecking**

Run: `pnpm typecheck`

Expected: clinic package, Astro docs, and Worker typechecks PASS.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: clinic TypeScript build and Astro static build PASS; static verifier accepts all routes and `_headers`.

- [ ] **Step 5: Verify deployed-shape headers through local Wrangler**

Start: `pnpm exec wrangler dev --local`

In a second terminal run:

```bash
curl --head http://localhost:8787/modules/01-state-modeling/
curl http://localhost:8787/healthz
curl --head http://localhost:8787/module-00/
```

Expected:

- module response includes both COOP and COEP headers;
- health response body is `ok`;
- compatibility route returns `308` to `/modules/00-break-the-app/`.

Stop Wrangler after the checks.

- [ ] **Step 6: Inspect the final diff and requirement coverage**

Run:

```bash
git diff --check main...HEAD
git status --short
git log --oneline main..HEAD
```

Confirm each accepted requirement maps to evidence:

- seven module workspaces: catalog and page integration tests;
- file selection/edit/reset: React tests;
- exactly one selected test/entrypoint: command tests;
- imports use all edited files: runner lifecycle test;
- one-time lazy install: runner lifecycle test;
- combined output and exit status: runner and UI tests;
- Cloudflare/local isolation headers: build verifier and Wrangler response;
- existing content and Worker behavior: full test/typecheck/build.
