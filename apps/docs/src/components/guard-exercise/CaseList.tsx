import type { GuardBehaviorPart } from "../../code-explorer/guard-paths";
import { verdictText, type DisplayRow } from "./labels";

export type GuardGuideSegment =
  | string
  | Readonly<{ text: string; href: string }>;

export type GuardGuideStep =
  | string
  | Readonly<{
      id?: string;
      text: string | readonly GuardGuideSegment[];
      items?: readonly string[];
    }>;

export type GuardGuide = Readonly<{
  title: string;
  criteria?: string;
  passedNext?: string;
  steps: readonly GuardGuideStep[];
}>;

export type CaseListProps = Readonly<{
  rows: readonly DisplayRow[];
  casePath: (id: string) => string | undefined;
  selectedPath: string | undefined;
  disabled: boolean;
  onSelect: (path: string) => void;
}>;

const BehaviorPart = ({
  label,
  part,
}: Readonly<{ label: string; part: GuardBehaviorPart }>) => (
  <>
    <span className="guard-exercise__behavior-label">{label}</span>
    <span className="guard-exercise__behavior-text">{part.text}</span>
    {part.value === undefined ? null : (
      <code className="guard-exercise__behavior-value">{part.value}</code>
    )}
  </>
);

export const CaseList = ({
  rows,
  casePath,
  selectedPath,
  disabled,
  onSelect,
}: CaseListProps) => (
  <div className="guard-exercise__cases-inner">
    <div className="guard-exercise__cases">
      <h3>悪い変更</h3>
      <ul className="guard-exercise__case-list" aria-label="悪い変更の一覧">
        {rows
          .filter(({ kind }) => kind === "bad")
          .map((row) => {
            const path = casePath(row.id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  data-case-id={row.id}
                  data-verdict={row.verdict ?? "unchecked"}
                  aria-current={path !== undefined && path === selectedPath}
                  disabled={disabled || path === undefined}
                  onClick={() => {
                    if (path !== undefined) onSelect(path);
                  }}
                >
                  <span className="guard-exercise__case-title">{row.title}</span>
                  <span className="guard-exercise__mark">
                    {verdictText(row.verdict)}
                  </span>
                  {row.behavior === undefined ? null : (
                    <span className="guard-exercise__behavior">
                      <span className="guard-exercise__behavior-input">
                        <BehaviorPart label="入力" part={row.behavior.input} />
                      </span>
                      <span
                        className="guard-exercise__behavior-side"
                        data-side="expected"
                      >
                        <BehaviorPart label="本来" part={row.behavior.expected} />
                      </span>
                      <span
                        className="guard-exercise__behavior-side"
                        data-side="actual"
                      >
                        <BehaviorPart
                          label="この変更では"
                          part={row.behavior.actual}
                        />
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  </div>
);
