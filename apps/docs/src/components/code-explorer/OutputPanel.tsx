import type { RunMode } from "../../code-explorer/run-command";

type ExecutionProvenance = Readonly<{
  filePath: string;
  mode: RunMode | undefined;
}>;

export type ExecutionState =
  | Readonly<{ kind: "idle" }>
  | (ExecutionProvenance &
      Readonly<{ kind: "working"; label: string; output: string }>)
  | (ExecutionProvenance &
      Readonly<{ kind: "finished"; output: string; exitCode: number }>)
  | (ExecutionProvenance &
      Readonly<{ kind: "canceled"; output: string; message: string }>)
  | (ExecutionProvenance &
      Readonly<{ kind: "error"; output: string; message: string }>);

export type OutputPanelProps = Readonly<{
  state: ExecutionState;
}>;

const statusFor = (state: ExecutionState): string => {
  if (state.kind === "error") return "failure";
  if (state.kind === "finished")
    return state.exitCode === 0 ? "success" : "failure";
  return state.kind;
};

const outputFor = (state: ExecutionState): string =>
  state.kind === "idle" ? "" : state.output;

const modeLabelFor = (mode: RunMode | undefined): string => {
  if (mode === "test") return "テスト";
  if (mode === "entrypoint") return "エントリポイント";
  return "実行不可";
};

export const OutputPanel = ({ state }: OutputPanelProps) => {
  const status = statusFor(state);

  return (
    <section
      className={`code-explorer__output code-explorer__output--${status}`}
      aria-label="実行結果"
      aria-live="polite"
      data-status={status}
    >
      {state.kind === "idle" ? <p>まだ実行していません。</p> : null}
      {state.kind !== "idle" ? (
        <p>
          実行対象: <code>{state.filePath}</code> / {modeLabelFor(state.mode)}
        </p>
      ) : null}
      {state.kind === "working" ? <p>{state.label}</p> : null}
      {state.kind === "finished" ? <p>終了コード {state.exitCode}</p> : null}
      {state.kind === "canceled" ? <p>{state.message}</p> : null}
      {state.kind === "error" ? <p>{state.message}</p> : null}
      <pre>{outputFor(state)}</pre>
    </section>
  );
};
