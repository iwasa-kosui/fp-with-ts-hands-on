import { Fragment } from "react";
import {
  guardPeerCaseId,
  type GuardBehaviorPart,
} from "../../code-explorer/guard-paths";
import {
  optionalGroupHeading,
  peerGroupHeading,
  peerRowNote,
  requiredGroupHeading,
  verdictText,
  type DisplayRow,
} from "./labels";
import { RowTitle } from "./RowTitle";

export type GuardGuideSegment =
  | string
  | Readonly<{ text: string; href: string }>;

export type GuardGuideReference = Readonly<{
  summary: string;
  text: string;
  caption: string;
  code: string;
}>;

export type GuardGuideStep =
  | string
  | Readonly<{
      id?: string;
      text: string | readonly GuardGuideSegment[];
      items?: readonly string[];
      reference?: GuardGuideReference;
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
  showPeerNote: boolean;
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
  showPeerNote,
  onSelect,
}: CaseListProps) => {
  const badRows = rows.filter(({ kind }) => kind === "bad");
  const peerRows = badRows.filter(({ id }) => id === guardPeerCaseId);
  const optionalRows = badRows.filter(
    ({ id, required }) => id !== guardPeerCaseId && !required,
  );
  const requiredRows = badRows.filter(
    ({ id, required }) => id !== guardPeerCaseId && required,
  );
  const grouped = optionalRows.length > 0 || peerRows.length > 0;

  const renderList = (
    list: readonly DisplayRow[],
    label: string,
    group?: string,
  ) => (
    <ul className="guard-exercise__case-list" aria-label={label}>
      {list.map((row) => {
        const path = casePath(row.id);
        return (
          <li key={row.id}>
            <button
              type="button"
              data-case-id={row.id}
              data-verdict={row.verdict ?? "unchecked"}
              data-group={group}
              aria-current={path !== undefined && path === selectedPath}
              disabled={disabled || path === undefined}
              onClick={() => {
                if (path !== undefined) onSelect(path);
              }}
            >
              <span className="guard-exercise__case-title">
                <RowTitle title={row.title} />
              </span>
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
            {group === "peer" && showPeerNote && row.verdict === "unchanged" ? (
              <span className="guard-exercise__peer-note">{peerRowNote}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderGroup = (
    heading: string,
    list: readonly DisplayRow[],
    group: string,
  ) =>
    list.length === 0 ? null : (
      <Fragment key={group}>
        <h4>{heading}</h4>
        {renderList(list, heading, group)}
      </Fragment>
    );

  return (
    <div className="guard-exercise__cases-inner">
      <div className="guard-exercise__cases">
        <h3>誤った変更</h3>
        {grouped ? (
          <>
            {renderGroup(requiredGroupHeading, requiredRows, "required")}
            {renderGroup(optionalGroupHeading, optionalRows, "optional")}
            {renderGroup(peerGroupHeading, peerRows, "peer")}
          </>
        ) : (
          renderList(badRows, "誤った変更の一覧")
        )}
      </div>
    </div>
  );
};
