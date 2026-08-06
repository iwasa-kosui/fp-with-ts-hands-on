export type ExecutionState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "working"; label: string; output: string }>
  | Readonly<{ kind: "finished"; output: string; exitCode: number }>
  | Readonly<{ kind: "error"; output: string; message: string }>;

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
      {state.kind === "working" ? <p>{state.label}</p> : null}
      {state.kind === "finished" ? <p>終了コード {state.exitCode}</p> : null}
      {state.kind === "error" ? <p>{state.message}</p> : null}
      <pre>{outputFor(state)}</pre>
    </section>
  );
};
