import type { PropsWithChildren, ReactElement } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export type StatusBadgeProps = PropsWithChildren<Readonly<{ tone: StatusTone }>>;

export const StatusBadge = ({ children, tone }: StatusBadgeProps): ReactElement => (
  <span className={`status-badge status-badge--${tone}`}>{children}</span>
);
