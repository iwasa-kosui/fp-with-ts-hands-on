import type { PropsWithChildren, ReactElement } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatusBadgeProps = PropsWithChildren<Readonly<{ tone: StatusTone }>>;

export const StatusBadge = ({ children, tone }: StatusBadgeProps): ReactElement => (
  <span className={`status-badge status-badge--${tone}`}>{children}</span>
);
