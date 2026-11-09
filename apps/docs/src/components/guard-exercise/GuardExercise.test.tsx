import "fake-indexeddb/auto";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardPaths } from "../../code-explorer/guard-paths";
import type { GuardResult } from "../../code-explorer/guard-result";
import { sampleGuardResult } from "../../code-explorer/guard-result.fixture";
import type {
  TerminalSession,
  TerminalStartRequest,
} from "../../code-explorer/runner";
import { createIndexedDbWorkspaceStore } from "../../code-explorer/workspace-store";
import { guardExercise } from "../../sessions/pages/03-boundaries-and-pii-exercise";
import { guardExerciseWorkspaceFor } from "../../sessions/pages/guard-exercise-workspace";
import type { EditorProps } from "../code-explorer/CodeExplorer";
import { phaseLabels, type TerminalView } from "../code-explorer/TerminalPanel";
import type { GuardGuide } from "./CaseList";
import { GuardExercise } from "./GuardExercise";

const TestEditor: ComponentType<EditorProps> = ({ value, readOnly }) => (
  <textarea
    aria-label="コードエディタ"
    data-readonly={String(readOnly)}
    value={value}
    readOnly
  />
);

const projectFiles = {
  "package.json": "{}",
  "eslint.config.mjs": "export default [];",
  [guardPaths.config]: `export default {
  subjects: {},
  cases: [
    { id: "B1-any-parser", kind: "bad", title: "parse が any を受け取る" },
    { id: "G1-solution", kind: "good", title: "正しい parse" },
  ],
};
`,
  "exercises/guard/cases/B1-any-parser.ts": "export const bad = 1;",
  "exercises/guard/cases/G1-solution.ts": "export const good = 1;",
  "exercises/guard/cases/R1-peer-change.ts": "// peer\nexport const peer = 1;",
  "exercises/guard/mine/input.test.ts": "// mine",
  "exercises/guard/subjects/input.ts": "// subject",
} as const;

const workspace = guardExerciseWorkspaceFor(guardExercise, projectFiles, "演習の作業場所");

const roots: Root[] = [];

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const settleUntil = async (isDone: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !isDone(); attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(isDone()).toBe(true);
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

type SessionOptions = Readonly<{
  initialFile?: string;
  exitCode?: number;
  resultText?: string | undefined;
  outdatedEdits?: boolean;
  guide?: GuardGuide;
  savedOutput?: string;
  onStart?: (request: TerminalStartRequest) => Promise<void>;
}>;

const createSession = (options: SessionOptions) => {
  const session: TerminalSession = {
    writeInput: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    resize: vi.fn(),
    restartShell: vi.fn(async () => undefined),
    runCommand: vi.fn(async () => options.exitCode ?? 1),
    readFile: vi.fn(async () =>
      "resultText" in options
        ? options.resultText
        : JSON.stringify(sampleGuardResult),
    ),
    dispose: vi.fn(async () => undefined),
  };
  return session;
};

const mountExercise = async (options: SessionOptions = {}) => {
  const session = createSession(options);
  const view: TerminalView = {
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    fit: vi.fn(() => ({ cols: 80, rows: 24 })),
    focus: vi.fn(),
    dispose: vi.fn(),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  if (options.outdatedEdits === true) {
    await createIndexedDbWorkspaceStore().saveEdits(
      workspace.slug,
      {
        "exercises/guard/mine/input.test.ts": {
          contents: "// edited",
          base: "// mine before the update",
        },
      },
      0,
    );
  }
  if (options.savedOutput !== undefined) {
    await createIndexedDbWorkspaceStore().saveTerminalOutput(
      workspace.slug,
      options.savedOutput,
      1,
    );
  }
  await act(async () => {
    root.render(
      <GuardExercise
        workspace={
          options.initialFile === undefined
            ? workspace
            : { ...workspace, initialFile: options.initialFile }
        }
        projectFiles={projectFiles}
        workspaceStore={createIndexedDbWorkspaceStore()}
        Editor={TestEditor}
        guide={options.guide}
        supportsRuntime={() => true}
        loadTerminalView={async () => view}
        runnerFactory={() => ({
          start: async (request) => {
            await options.onStart?.(request);
            return session;
          },
        })}
      />,
    );
  });
  await settleUntil(() =>
    options.outdatedEdits === true
      ? action(host, "use-saved-edits") !== null
      : action(host, "run-guard")?.disabled === false &&
        host.querySelector("table") !== null,
  );
  await settle();
  return { host, root, session, unmount: () => act(async () => root.unmount()) };
};

const click = async (element: Element | null | undefined) => {
  await act(async () => {
    (element as HTMLElement | null | undefined)?.click();
  });
  await settle();
};

const action = (host: HTMLElement, name: string) =>
  host.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const row = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`);

const typeInto = async (textarea: HTMLTextAreaElement, value: string) => {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setValue.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const editor = (host: HTMLElement) =>
  host.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="コードエディタ"]',
  )!;

describe("GuardExercise", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("lists the bad changes and shows an unchecked table before the first run", async () => {
    const { host } = await mountExercise();

    const cases = [...host.querySelectorAll("[data-case-id]")];
    expect(cases.map((item) => item.getAttribute("data-case-id"))).toEqual([
      "B1-any-parser",
    ]);
    expect(cases[0]?.getAttribute("data-verdict")).toBe("unchecked");
    expect(host.textContent).toContain("まだ確かめていません");
    expect(host.textContent).toContain("正しいコード");
    expect(row(host, "G1-solution")?.textContent).toContain("未確認");
  });

  it("keeps the table terms inside a details element while the table is rendered", async () => {
    const { host } = await mountExercise();

    const terms = host.querySelector("details");
    expect(terms?.open).toBe(false);
    expect(terms?.querySelector("summary")).not.toBeNull();
    expect(terms?.textContent?.length ?? 0).toBeGreaterThan(
      terms?.querySelector("summary")?.textContent?.length ?? 0,
    );
    expect(host.querySelector("table")).not.toBeNull();
    expect(terms?.contains(host.querySelector("table"))).toBe(false);
  });

  it("scrolls the table terms into view only when the details element opens", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      const { host } = await mountExercise();
      const terms = host.querySelector("details")!;

      await act(async () => {
        terms.dispatchEvent(new Event("toggle"));
      });
      expect(scrollIntoView).not.toHaveBeenCalled();

      terms.open = true;
      await act(async () => {
        terms.dispatchEvent(new Event("toggle"));
      });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrollIntoView.mock.contexts[0]).toBe(terms.querySelector("p"));
    } finally {
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
  });

  it("opens the case file read-only and the mine file editable", async () => {
    const { host } = await mountExercise();

    await click(host.querySelector('[data-case-id="B1-any-parser"]'));
    expect(editor(host).value).toBe("export const bad = 1;");
    expect(editor(host).dataset.readonly).toBe("true");

    await click(
      host.querySelector('button[data-path="exercises/guard/mine/input.test.ts"]'),
    );
    expect(editor(host).value).toBe("// mine");
    expect(editor(host).dataset.readonly).toBe("false");
  });

  it("lets the participant edit only the peer review case among the cases", async () => {
    const peer = await mountExercise({ initialFile: guardPaths.peerCase });
    expect(editor(peer.host).value).toContain("export const peer = 1;");
    expect(editor(peer.host).dataset.readonly).toBe("false");

    const good = await mountExercise({
      initialFile: "exercises/guard/cases/G1-solution.ts",
    });
    expect(editor(good.host).dataset.readonly).toBe("true");
  });

  it("shows tabs for the config, the mine files, and the opened case file", async () => {
    const { host } = await mountExercise();
    const tabPaths = () =>
      [...host.querySelectorAll(".code-explorer__tabs button")].map((tab) =>
        tab.getAttribute("data-path"),
      );

    expect(tabPaths()).toEqual(["eslint.config.mjs", "exercises/guard/mine/input.test.ts"]);

    await click(host.querySelector('[data-case-id="B1-any-parser"]'));
    expect(tabPaths()).toEqual([
      "eslint.config.mjs",
      "exercises/guard/mine/input.test.ts",
      "exercises/guard/cases/B1-any-parser.ts",
    ]);
  });

  it("shows the guide given by props in place of the default steps", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => {
      root.render(
        <GuardExercise
          workspace={workspace}
          projectFiles={projectFiles}
          workspaceStore={createIndexedDbWorkspaceStore()}
          Editor={TestEditor}
          guide={{
            title: "相互レビューでやること",
            steps: ["手順1です。", { text: "問いは次の2つです。", items: ["問いA", "問いB"] }],
          }}
        />,
      );
    });
    await settleUntil(() => action(host, "run-guard")?.disabled === false);

    expect(host.querySelector(".guard-exercise__cases-inner h2")?.textContent).toBe(
      "相互レビューでやること",
    );
    expect(host.querySelectorAll(".guard-exercise__steps > li")).toHaveLength(2);
    expect(host.querySelectorAll(".guard-exercise__steps ul li")).toHaveLength(2);
    expect(host.textContent).not.toContain("悪い変更をコードで見る");
  });

  it("renders guide segments with href as links and puts the step id on the item", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => {
      root.render(
        <GuardExercise
          workspace={workspace}
          projectFiles={projectFiles}
          workspaceStore={createIndexedDbWorkspaceStore()}
          Editor={TestEditor}
          guide={{
            title: "リンクの確認",
            steps: [
              "手順1です。",
              {
                id: "step-links",
                text: [
                  "書き方は ",
                  { text: "前のページ", href: "/sessions/example/previous/" },
                  " と ",
                  { text: "その前のページ", href: "/sessions/example/earlier/" },
                  " にあります。",
                ],
                items: ["補足A"],
              },
            ],
          }}
        />,
      );
    });
    await settleUntil(() => action(host, "run-guard")?.disabled === false);

    const items = host.querySelectorAll(".guard-exercise__steps > li");
    expect(items).toHaveLength(2);
    expect(items[0]?.hasAttribute("id")).toBe(false);
    expect(items[1]?.id).toBe("step-links");
    expect(items[1]?.textContent).toBe(
      "書き方は 前のページ と その前のページ にあります。補足A",
    );
    expect(
      [...(items[1]?.querySelectorAll("a") ?? [])].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    ).toEqual([
      ["前のページ", "/sessions/example/previous/"],
      ["その前のページ", "/sessions/example/earlier/"],
    ]);
  });

  describe("the next step after a pass", () => {
    const passedResult: GuardResult = {
      ...sampleGuardResult,
      passed: true,
      rows: sampleGuardResult.rows.map((item) =>
        item.kind === "bad" ? { ...item, verdict: "detected" } : item,
      ),
      next: ["合格です。表の行を開きます。"],
    };
    const nextText = (host: HTMLElement) =>
      host.querySelector(".guard-exercise__next p")?.textContent;

    it("shows the sentence from the result when the guide gives none", async () => {
      const { host } = await mountExercise({
        exitCode: 0,
        resultText: JSON.stringify(passedResult),
        guide: { title: "案内", steps: ["手順です。"] },
      });

      await click(action(host, "run-guard"));

      expect(nextText(host)).toBe("合格です。表の行を開きます。");
    });

    it("replaces the sentence of a pass with the one the guide gives", async () => {
      const { host } = await mountExercise({
        exitCode: 0,
        resultText: JSON.stringify(passedResult),
        guide: { title: "案内", passedNext: "別の次の操作です。", steps: ["手順です。"] },
      });

      await click(action(host, "run-guard"));

      expect(nextText(host)).toBe("別の次の操作です。");
    });

    it("keeps the sentence from the result while the guard has not passed", async () => {
      const { host } = await mountExercise({
        guide: { title: "案内", passedNext: "別の次の操作です。", steps: ["手順です。"] },
      });

      await click(action(host, "run-guard"));

      expect(nextText(host)).toBe("まだ仕組みがありません。");
    });
  });

  describe("opening the terminal", () => {
    const terminalState = (host: HTMLElement) =>
      host.querySelector(".code-explorer__terminal")?.getAttribute("data-state");

    it("does not start the runtime while the terminal stays collapsed", async () => {
      const onStart = vi.fn(async () => undefined);
      const { host } = await mountExercise({ onStart });

      expect(onStart).not.toHaveBeenCalled();
      expect(terminalState(host)).toBe("unstarted");
    });

    it("starts it once when the participant opens the terminal, and asks nothing about restarting", async () => {
      const onStart = vi.fn(async () => undefined);
      const { host } = await mountExercise({
        onStart,
        savedOutput: "前回の出力です\r\n",
      });
      await settleUntil(() => host.querySelector(".code-explorer__terminal-status") !== null);

      await click(action(host, "toggle-terminal"));
      await settleUntil(() => terminalState(host) === "ready");

      expect(onStart).toHaveBeenCalledOnce();
      expect(host.querySelector(".code-explorer__terminal-prompt")).toBeNull();
      expect(host.querySelector(".code-explorer__terminal-status")).toBeNull();

      await click(action(host, "toggle-terminal"));
      await click(action(host, "toggle-terminal"));
      expect(onStart).toHaveBeenCalledOnce();
    });

    it("reuses the runtime that the guard run already started", async () => {
      const onStart = vi.fn(async () => undefined);
      const { host } = await mountExercise({ onStart });

      await click(action(host, "run-guard"));
      await click(action(host, "toggle-terminal"));

      expect(onStart).toHaveBeenCalledOnce();
    });
  });

  it("starts the terminal, runs the guard, and fills the table", async () => {
    const { host, session } = await mountExercise();

    await click(action(host, "run-guard"));

    expect(session.runCommand).toHaveBeenCalledWith(
      "node",
      ["vendor/exercise-guard/cli.mjs"],
      { cols: 80, rows: 24 },
    );
    expect(session.readFile).toHaveBeenCalledWith(guardPaths.result);
    expect(row(host, "B1-any-parser")?.textContent).toContain("すり抜け");
    expect(row(host, "B1-any-parser")?.textContent).toContain("対象外");
    expect(
      row(host, "B1-any-parser")?.querySelector('td[data-state="none"]')
        ?.textContent,
    ).toBe("未検出");
    expect(row(host, "G1-solution")?.textContent).toContain("誤検知なし");
    expect(
      row(host, "G1-solution")?.querySelector('td[data-state="none"]')
        ?.textContent,
    ).toBe("なし");
    expect(host.textContent).toContain("まだ仕組みがありません。");
    expect(host.textContent).toContain("まだ合格していません");
    expect(host.querySelector(".guard-exercise__badge")).toBeNull();
    expect(
      host.querySelector('[data-case-id="B1-any-parser"]')?.getAttribute("data-verdict"),
    ).toBe("slipped");
  });

  it("keeps the run button disabled with a reason until the outdated edits notice is answered", async () => {
    const answered = ["use-saved-edits", "use-updated-code"] as const;
    for (const choice of answered) {
      const { host, session, unmount } = await mountExercise({
        outdatedEdits: true,
      });

      expect(action(host, "run-guard")?.disabled).toBe(true);
      expect(host.querySelector('[data-role="outdated"]')?.textContent).toContain(
        "案内に答えると、検出を確かめられます。",
      );
      await click(action(host, "run-guard"));
      expect(session.runCommand).not.toHaveBeenCalled();

      await click(action(host, choice));

      expect(action(host, "run-guard")?.disabled).toBe(false);
      expect(host.querySelector('[data-role="outdated"]')).toBeNull();
      await unmount();
      host.remove();
      globalThis.indexedDB = new IDBFactory();
    }
  });

  it("shows the startup phase as progress and blocks a second run", async () => {
    const started = deferred<void>();
    const { host } = await mountExercise({
      onStart: async (request) => {
        request.onPhase("installing");
        await started.promise;
      },
    });

    await act(async () => {
      action(host, "run-guard")?.click();
    });
    await settle();

    expect(host.querySelector('[role="status"] progress')).not.toBeNull();
    expect(host.textContent).toContain(phaseLabels.installing);
    expect(action(host, "run-guard")?.disabled).toBe(true);

    await act(async () => started.resolve());
    await settle();

    expect(action(host, "run-guard")?.disabled).toBe(false);
    expect(row(host, "B1-any-parser")?.textContent).toContain("すり抜け");
  });

  it("shows the hint of a slipped row only after the row is opened", async () => {
    const { host } = await mountExercise();
    await click(action(host, "run-guard"));
    expect(host.querySelector('[data-role="hint"]')).toBeNull();

    await click(row(host, "B1-any-parser")?.querySelector("button"));

    expect(host.querySelector('[data-role="hint"]')?.textContent).toContain(
      "any を禁じる規則で検出します。",
    );
  });

  it("shows a passed result as a pass", async () => {
    const passed: GuardResult = {
      ...sampleGuardResult,
      passed: true,
      rows: sampleGuardResult.rows.map((item) =>
        item.kind === "bad" ? { ...item, verdict: "detected" } : item,
      ),
    };
    const { host } = await mountExercise({
      exitCode: 0,
      resultText: JSON.stringify(passed),
    });

    await click(action(host, "run-guard"));

    expect(
      host.querySelector(".guard-exercise__headline")?.getAttribute("data-passed"),
    ).toBe("true");
    expect(host.querySelector(".guard-exercise__headline")?.textContent).toContain(
      "合格です",
    );
  });

  it("marks a row with a false positive", async () => {
    const falsePositive: GuardResult = {
      ...sampleGuardResult,
      rows: sampleGuardResult.rows.map((item) =>
        item.kind === "good" ? { ...item, verdict: "falsePositive" } : item,
      ),
    };
    const { host } = await mountExercise({
      resultText: JSON.stringify(falsePositive),
    });

    await click(action(host, "run-guard"));

    expect(row(host, "G1-solution")?.dataset.verdict).toBe("falsePositive");
    expect(row(host, "G1-solution")?.textContent).toContain("誤検知あり");
  });

  it("shows an unchanged row as 未変更 in the table and the case list, without the hint", async () => {
    const unchanged: GuardResult = {
      ...sampleGuardResult,
      rows: sampleGuardResult.rows.map((item) =>
        item.kind === "bad" ? { ...item, verdict: "unchanged" } : item,
      ),
    };
    const { host } = await mountExercise({
      resultText: JSON.stringify(unchanged),
    });

    await click(action(host, "run-guard"));
    await click(row(host, "B1-any-parser")?.querySelector("button"));

    expect(row(host, "B1-any-parser")?.dataset.verdict).toBe("unchanged");
    expect(row(host, "B1-any-parser")?.textContent).toContain("未変更");
    expect(row(host, "B1-any-parser")?.textContent).not.toContain("すり抜け");
    expect(
      host.querySelector('[data-case-id="B1-any-parser"]')?.textContent,
    ).toContain("未変更");
    expect(host.querySelector('[data-role="hint"]')).toBeNull();
  });

  it("reports a result that cannot be read", async () => {
    const { host } = await mountExercise({ resultText: undefined });

    await click(action(host, "run-guard"));

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "結果を読み出せませんでした",
    );
    expect(action(host, "run-guard")?.disabled).toBe(false);
  });

  it("reports a guard that ended with a configuration error", async () => {
    const { host, session } = await mountExercise({ exitCode: 2 });

    await click(action(host, "run-guard"));

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "終了コード 2",
    );
    expect(session.readFile).not.toHaveBeenCalled();
  });

  it("reports why the terminal could not start", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => {
      root.render(
        <GuardExercise
          workspace={workspace}
          projectFiles={projectFiles}
          workspaceStore={createIndexedDbWorkspaceStore()}
          Editor={TestEditor}
          supportsRuntime={() => false}
        />,
      );
    });
    await settleUntil(() => action(host, "run-guard")?.disabled === false);

    await click(action(host, "run-guard"));

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "ChromeまたはEdgeで開き",
    );
  });

  it("brings the table back after a reload and labels it as the previous result", async () => {
    const first = await mountExercise();
    await click(action(first.host, "run-guard"));
    await first.unmount();
    first.host.remove();

    const second = await mountExercise();
    await settleUntil(
      () => second.host.querySelector(".guard-exercise__badge") !== null,
    );

    expect(second.host.querySelector(".guard-exercise__badge")?.textContent).toBe(
      "前回の結果",
    );
    expect(row(second.host, "B1-any-parser")?.textContent).toContain("すり抜け");
    expect(
      second.host
        .querySelector('[data-case-id="B1-any-parser"]')
        ?.getAttribute("data-verdict"),
    ).toBe("slipped");
    expect(second.session.runCommand).not.toHaveBeenCalled();

    await click(action(second.host, "run-guard"));

    expect(second.host.querySelector(".guard-exercise__badge")).toBeNull();
    expect(second.session.runCommand).toHaveBeenCalledOnce();
  });

  it("keeps what was written under limitations after moving to another page and back", async () => {
    const first = await mountExercise();
    await click(action(first.host, "run-guard"));
    await click(row(first.host, "B1-any-parser")?.querySelector("button"));
    await typeInto(
      first.host.querySelector<HTMLTextAreaElement>(".guard-exercise__detail textarea")!,
      "別の書き方は検出できない",
    );
    expect(row(first.host, "B1-any-parser")?.textContent).toContain(
      "検出できないことを記入済み",
    );
    await first.unmount();
    first.host.remove();

    const second = await mountExercise();
    await settleUntil(() => row(second.host, "B1-any-parser") !== null);
    await click(row(second.host, "B1-any-parser")?.querySelector("button"));
    await settleUntil(
      () =>
        second.host.querySelector<HTMLTextAreaElement>(
          ".guard-exercise__detail textarea",
        )?.value === "別の書き方は検出できない",
    );

    expect(
      second.host.querySelector<HTMLTextAreaElement>(".guard-exercise__detail textarea")
        ?.value,
    ).toBe("別の書き方は検出できない");
    expect(second.host.textContent).toContain(
      "機械では判定しません",
    );
  });

  it("keeps the terminal mounted while it is collapsed", async () => {
    const { host } = await mountExercise();
    const terminal = host.querySelector<HTMLElement>(".guard-exercise__terminal")!;

    expect(terminal.hidden).toBe(true);
    expect(terminal.querySelector(".code-explorer__terminal")).not.toBeNull();

    await click(action(host, "toggle-terminal"));
    expect(terminal.hidden).toBe(false);
    expect(action(host, "toggle-terminal")?.getAttribute("aria-expanded")).toBe(
      "true",
    );

    await click(action(host, "toggle-terminal"));
    expect(terminal.hidden).toBe(true);
  });
});
