import type { ReactElement } from "react";

import type { ReceptionBoardRow } from "../../../../useCase/query/receptionBoardReader.js";
import { ReceptionRow } from "./ReceptionRow.js";

type Props = Readonly<{
  sectionKey: string;
  label: string;
  rows: readonly ReceptionBoardRow[];
  initiallyExpanded: boolean;
  onSubmittingChange?: ((submitting: boolean) => void) | undefined;
}>;

export const ReceptionSection = ({ sectionKey, label, rows, initiallyExpanded, onSubmittingChange }: Props): ReactElement => (
  <details className={`reception-section reception-section--${sectionKey}`} open={initiallyExpanded}>
    <summary id={`reception-${sectionKey}`}>
      <span>{label}</span>
      <span>{rows.length}件</span>
    </summary>
    <section aria-labelledby={`reception-${sectionKey}`} className="reception-section__rows">
      {rows.length === 0
        ? <p className="reception-section__empty">該当する予約はありません。</p>
        : rows.map((row) => <ReceptionRow key={row.appointmentId} row={row} onSubmittingChange={onSubmittingChange} />)}
    </section>
  </details>
);
