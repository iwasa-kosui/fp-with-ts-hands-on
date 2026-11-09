import { Fragment, useRef, useState } from "react";
import { guardPeerCaseId } from "../../code-explorer/guard-paths";
import {
  guardMechanisms,
  type GuardResult,
} from "../../code-explorer/guard-result";
import {
  cellText,
  headlineFor,
  mechanismHeaders,
  optionalGroupHeading,
  peerGroupHeading,
  peerRowNote,
  requiredGroupHeading,
  secondsText,
  tableTermsSummary,
  tableTermsText,
  verdictText,
  type DisplayRow,
} from "./labels";

export type ResultTableProps = Readonly<{
  result: GuardResult;
  rows: readonly DisplayRow[];
  restored: boolean;
  limitations: Readonly<Record<string, string>>;
  limitationsEnabled: boolean;
  passedNext?: string;
  onLimitationChange: (id: string, text: string) => void;
}>;

const columnCount = guardMechanisms.length + 2;

type RowGroup = "required" | "optional" | "peer";

export const ResultTable = ({
  result,
  rows,
  restored,
  limitations,
  limitationsEnabled,
  passedNext,
  onLimitationChange,
}: ResultTableProps) => {
  const [openId, setOpenId] = useState<string>();
  const termsTextRef = useRef<HTMLParagraphElement>(null);
  const badRows = rows.filter(({ kind }) => kind === "bad");
  const goodRows = rows.filter(({ kind }) => kind === "good");
  const peerRows = badRows.filter(({ id }) => id === guardPeerCaseId);
  const optionalRows = badRows.filter(
    ({ id, required }) => id !== guardPeerCaseId && !required,
  );
  const requiredRows = badRows.filter(
    ({ id, required }) => id !== guardPeerCaseId && required,
  );
  const grouped = optionalRows.length > 0 || peerRows.length > 0;

  const renderRows = (list: readonly DisplayRow[], group?: RowGroup) =>
    list.map((row) => {
      const isBad = row.kind === "bad";
      const isOpen = isBad && openId === row.id;
      const written = (limitations[row.id] ?? "").trim() !== "";
      return (
        <Fragment key={row.id}>
        <tr
          data-row-id={row.id}
          data-verdict={row.verdict ?? "unchecked"}
          data-group={group}
        >
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
            {group === "peer" &&
            passedNext === undefined &&
            row.verdict === "unchanged" ? (
              <span className="guard-exercise__peer-note">{peerRowNote}</span>
            ) : null}
          </th>
          {guardMechanisms.map((mechanism) => (
            <td
              key={mechanism}
              data-state={row.cells === undefined ? "none" : row.cells[mechanism].state}
            >
              {row.cells === undefined || row.verdict === "unchanged"
                ? "−"
                : cellText(row.cells[mechanism], row.kind)}
            </td>
          ))}
          <td className="guard-exercise__verdict">
            <span className="guard-exercise__state">{verdictText(row.verdict)}</span>
          </td>
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

  const renderGroup = (
    heading: string,
    list: readonly DisplayRow[],
    group: RowGroup,
  ) =>
    list.length === 0 ? null : (
      <>
        <tbody>
          <tr className="guard-exercise__group">
            <th colSpan={columnCount} scope="colgroup">
              {heading}
            </th>
          </tr>
        </tbody>
        <tbody>{renderRows(list, group)}</tbody>
      </>
    );

  return (
    <div className="guard-exercise__table-area">
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
      {result.next[0] !== undefined ? (
        <section className="guard-exercise__next" aria-label="次にすること">
          <h3>次にすること</h3>
          <p>{result.passed && passedNext !== undefined ? passedNext : result.next[0]}</p>
        </section>
      ) : null}
      <table className="guard-exercise__table">
        <thead>
          <tr>
            <th scope="col">誤った変更</th>
            {guardMechanisms.map((mechanism) => (
              <th key={mechanism} scope="col">
                {mechanismHeaders[mechanism]}
              </th>
            ))}
            <th scope="col">結果</th>
          </tr>
        </thead>
        {grouped ? (
          <>
            {renderGroup(requiredGroupHeading, requiredRows, "required")}
            {renderGroup(optionalGroupHeading, optionalRows, "optional")}
            {renderGroup(peerGroupHeading, peerRows, "peer")}
          </>
        ) : (
          <tbody>{renderRows(badRows)}</tbody>
        )}
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
      <div className="guard-exercise__limits">
        <p className="guard-exercise__limits-note">
          「結果」の列は、「対象外」ではない列のどれか 1 つが検出すれば「検出」です。
          {result.passed && passedNext === undefined
            ? "行の題名の ▶ を押すと開く「この仕組みで検出できないこと」の欄に、表の少なくとも 1 つの行で 1 文を記入します。記入の内容はプログラムでは判定しません。"
            : null}
        </p>
        <details
          className="guard-exercise__terms"
          onToggle={(event) => {
            if (event.currentTarget.open) {
              termsTextRef.current?.scrollIntoView({ block: "nearest" });
            }
          }}
        >
          <summary>{tableTermsSummary}</summary>
          <p ref={termsTextRef}>{tableTermsText}</p>
        </details>
      </div>
      {result.problems.length > 0 ? (
        <section className="guard-exercise__problems" aria-label="問題">
          <h3>問題</h3>
          <ul>
            {result.problems.map((problem, index) => (
              <li key={`${index}:${problem}`}>{problem}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result.notes.length > 0 ? (
        <section className="guard-exercise__notes" aria-label="補足">
          <h3>補足</h3>
          <ul>
            {result.notes.map((note, index) => (
              <li key={`${index}:${note}`}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="guard-exercise__durations">
        所要: 全体 {secondsText(result.durations.total)}（型{" "}
        {secondsText(result.durations.types)}、Linter{" "}
        {secondsText(result.durations.lint)}。テスト{" "}
        {secondsText(result.durations.tests)} は並行して実行）
      </p>
    </div>
  );
};
