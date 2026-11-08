import { useId, useMemo, useState } from "react";
import {
  casePathFor,
  type GuardCaseInfo,
} from "../../code-explorer/guard-paths";
import type { ProjectFiles } from "../../code-explorer/types";
import type { GuardWorkspaceStore } from "../../code-explorer/workspace-store";
import type { TerminalPhase } from "../../code-explorer/runner";
import type { CodeExplorerLayoutParts } from "../code-explorer/CodeExplorer";
import { phaseLabels } from "../code-explorer/TerminalPanel";
import { CaseList, type GuardGuide } from "./CaseList";
import { displayRowsFor } from "./labels";
import { ResultTable } from "./ResultTable";
import { useGuardRun, type GuardRunStep } from "./useGuardRun";

export type GuardLayoutProps = Readonly<{
  parts: CodeExplorerLayoutParts;
  store: GuardWorkspaceStore;
  slug: string;
  projectFiles: ProjectFiles;
  cases: readonly GuardCaseInfo[];
  guide?: GuardGuide;
}>;

const phaseOrder = [
  "booting",
  "mounting",
  "downloading-deps",
  "restoring-deps",
  "installing",
  "collecting-types",
  "starting-shell",
] as const satisfies readonly TerminalPhase[];

const stepLabels: Readonly<Record<Exclude<GuardRunStep, "starting">, string>> = {
  judging: "検査を実行しています。",
  reading: "結果を読み込んでいます。",
};

const totalSteps = phaseOrder.length + 2;

const progressFor = (
  step: GuardRunStep,
  phase: TerminalPhase | undefined,
): Readonly<{ label: string; value: number }> => {
  if (step === "starting") {
    return phase === undefined
      ? { label: "実行環境を準備しています。", value: 0 }
      : { label: phaseLabels[phase], value: phaseOrder.indexOf(phase) + 1 };
  }
  return {
    label: stepLabels[step],
    value: phaseOrder.length + (step === "judging" ? 1 : 2),
  };
};

export const GuardLayout = ({
  parts,
  store,
  slug,
  projectFiles,
  cases,
  guide,
}: GuardLayoutProps) => {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const terminalId = useId();
  const guard = useGuardRun({
    store,
    slug,
    acquireSession: parts.acquireSession,
  });
  const paths = useMemo(() => Object.keys(projectFiles), [projectFiles]);
  const rows = useMemo(
    () => displayRowsFor(guard.result, cases),
    [guard.result, cases],
  );
  const running = guard.status.kind === "running";
  const progress =
    guard.status.kind === "running"
      ? progressFor(guard.status.step, parts.terminalPhase)
      : undefined;

  return (
    <div className="guard-exercise__grid">
      <aside className="guard-exercise__column guard-exercise__column--cases">
        <CaseList
          rows={rows}
          casePath={(id) => casePathFor(paths, id)}
          selectedPath={parts.selectedPath}
          disabled={parts.locked}
          onSelect={parts.selectPath}
          guide={guide}
        />
      </aside>
      <div className="guard-exercise__column guard-exercise__column--center">
        <div className="guard-exercise__workspace">{parts.workspace}</div>
        <div className="guard-exercise__terminal-bar">
          <button
            type="button"
            data-action="toggle-terminal"
            aria-expanded={terminalOpen}
            aria-controls={terminalId}
            onClick={() => setTerminalOpen((open) => !open)}
          >
            {terminalOpen ? "ターミナルを閉じる" : "ターミナルを開く"}
          </button>
        </div>
        <div
          id={terminalId}
          className="guard-exercise__terminal"
          hidden={!terminalOpen}
        >
          {parts.terminal}
        </div>
      </div>
      <section
        className="guard-exercise__column guard-exercise__column--result"
        aria-label="検査の結果"
      >
        <div className="guard-exercise__run">
          <button
            type="button"
            data-action="run-guard"
            disabled={running || parts.locked}
            onClick={() => void guard.run()}
          >
            {running ? "検査しています" : "検査する"}
          </button>
          {progress === undefined ? null : (
            <div className="guard-exercise__progress" role="status" aria-live="polite">
              <progress max={totalSteps} value={progress.value} />
              <span>{progress.label}</span>
            </div>
          )}
        </div>
        {guard.status.kind === "failed" ? (
          <p className="guard-exercise__error" role="alert">
            {guard.status.message}
          </p>
        ) : null}
        {guard.notice === undefined ? null : (
          <p className="guard-exercise__error" role="alert">
            {guard.notice}
          </p>
        )}
        <ResultTable
          result={guard.result}
          rows={rows}
          restored={guard.source === "restored"}
          limitations={guard.limitations}
          limitationsEnabled={guard.ready}
          onLimitationChange={guard.setLimitation}
        />
      </section>
    </div>
  );
};
