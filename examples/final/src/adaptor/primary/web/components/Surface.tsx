import type { PropsWithChildren, ReactElement } from "react";

type SurfaceProps = PropsWithChildren<Readonly<{ className?: string }>>;

const classNames = (base: string, className: string | undefined): string =>
  [base, className].filter(Boolean).join(" ");

export const Card = ({ children, className }: SurfaceProps): ReactElement => (
  <div className={classNames("surface-card", className)}>{children}</div>
);

export const EmptyState = ({ children, className }: SurfaceProps): ReactElement => (
  <div className={classNames("empty-state", className)}>{children}</div>
);

export const InlineAlert = ({ children, className }: SurfaceProps): ReactElement => (
  <div className={classNames("inline-alert", className)} role="status">
    {children}
  </div>
);
