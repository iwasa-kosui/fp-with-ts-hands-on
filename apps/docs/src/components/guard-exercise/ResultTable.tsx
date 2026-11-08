import { Fragment, useState } from "react";
import {
  guardMechanisms,
  type GuardResult,
} from "../../code-explorer/guard-result";
import {
  cellText,
  headlineFor,
  mechanismHeaders,
  secondsText,
  verdictText,
  type DisplayRow,
} from "./labels";

export type ResultTableProps = Readonly<{
  result: GuardResult | undefined;
  rows: readonly DisplayRow[];
  restored: boolean;
  limitations: Readonly<Record<string, string>>;
  limitationsEnabled: boolean;
  onLimitationChange: (id: string, text: string) => void;
}>;

const columnCount = guardMechanisms.length + 2;

export const ResultTable = ({
  result,
  rows,
  restored,
  limitations,
  limitationsEnabled,
  onLimitationChange,
}: ResultTableProps) => {
  const [openId, setOpenId] = useState<string>();
  const badRows = rows.filter(({ kind }) => kind === "bad");
  const goodRows = rows.filter(({ kind }) => kind === "good");

  const renderRows = (list: readonly DisplayRow[]) =>
    list.map((row) => {
      const isBad = row.kind === "bad";
      const isOpen = isBad && openId === row.id;
      const written = (limitations[row.id] ?? "").trim() !== "";
      return (
        <Fragment key={row.id}>
        <tr data-row-id={row.id} data-verdict={row.verdict ?? "unchecked"}>
          <th scope="row">
            {isBad ? (
              <button
                type="button"
                data-action="toggle-row"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? undefined : row.id)}
              >
                {row.title}
              </button>
            ) : (
              <span>{row.title}</span>
            )}
            {isBad && written ? (
              <span className="guard-exercise__written">
                検出できないことを記入済み
              </span>
            ) : null}
          </th>
          {guardMechanisms.map((mechanism) => (
            <td
              key={mechanism}
              data-state={row.cells === undefined ? "none" : row.cells[mechanism].state}
            >
              {row.cells === undefined ? "−" : cellText(row.cells[mechanism])}
            </td>
          ))}
          <td className="guard-exercise__verdict">{verdictText(row.verdict)}</td>
        </tr>
        {isOpen ? (
          <tr className="guard-exercise__detail">
            <td colSpan={columnCount}>
              {row.verdict === "slipped" && row.hint !== "" ? (
                <p data-role="hint">ヒント: {row.hint}</p>
              ) : null}
              <label>
                <span>この仕組みで検出できないこと</span>
                <textarea
                  rows={3}
                  value={limitations[row.id] ?? ""}
                  disabled={!limitationsEnabled}
                  onChange={(event) =>
                    onLimitationChange(row.id, event.currentTarget.value)
                  }
                />
              </label>
            </td>
          </tr>
        ) : null}
        </Fragment>
      );
    });

  return (
    <div className="guard-exercise__table-area">
      {result === undefined ? (
        <p className="guard-exercise__status" data-role="unchecked">
          まだ確かめていません。「検出を確かめる」を押すと、悪い変更ごとの結果が表に出ます。
        </p>
      ) : (
        <p
          className="guard-exercise__headline"
          data-passed={result.passed}
          role="status"
        >
          {restored ? (
            <span className="guard-exercise__badge">前回の結果</span>
          ) : null}
          {headlineFor(result)}
        </p>
      )}
      {result !== undefined && result.next[0] !== undefined ? (
        <section className="guard-exercise__next" aria-label="次にすること">
          <h3>次にすること</h3>
          <p>{result.next[0]}</p>
        </section>
      ) : null}
      <table className="guard-exercise__table">
        <thead>
          <tr>
            <th scope="col">悪い変更</th>
            {guardMechanisms.map((mechanism) => (
              <th key={mechanism} scope="col">
                {mechanismHeaders[mechanism]}
              </th>
            ))}
            <th scope="col">結果</th>
          </tr>
        </thead>
        <tbody>{renderRows(badRows)}</tbody>
        {goodRows.length > 0 ? (
          <>
            <tbody>
              <tr className="guard-exercise__group">
                <th colSpan={columnCount} scope="colgroup">
                  正しいコード
                </th>
              </tr>
            </tbody>
            <tbody>{renderRows(goodRows)}</tbody>
          </>
        ) : null}
      </table>
      <p className="guard-exercise__limits-note">
        各行を開いて書く「この仕組みで検出できないこと」は、機械では判定しません。
      </p>
      {result !== undefined && result.problems.length > 0 ? (
        <section className="guard-exercise__problems" aria-label="問題">
          <h3>問題</h3>
          <ul>
            {result.problems.map((problem, index) => (
              <li key={`${index}:${problem}`}>{problem}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result !== undefined && result.notes.length > 0 ? (
        <section className="guard-exercise__notes" aria-label="補足">
          <h3>補足</h3>
          <ul>
            {result.notes.map((note, index) => (
              <li key={`${index}:${note}`}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result !== undefined ? (
        <p className="guard-exercise__durations">
          所要: 型 {secondsText(result.durations.types)} / Linter{" "}
          {secondsText(result.durations.lint)} / テスト{" "}
          {secondsText(result.durations.tests)} / 合計{" "}
          {secondsText(result.durations.total)}
        </p>
      ) : null}
    </div>
  );
};
