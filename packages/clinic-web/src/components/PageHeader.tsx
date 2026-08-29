import type { ReactElement, ReactNode } from "react";

export type PageHeaderProps = Readonly<{
  actions?: ReactNode;
  description?: string | undefined;
  title: string;
}>;

export const PageHeader = ({
  actions,
  description,
  title,
}: PageHeaderProps): ReactElement => (
  <header className="page-header">
    <div>
      <h1>{title}</h1>
      {description === undefined ? null : (
        <p className="page-header__description">{description}</p>
      )}
    </div>
    {actions === undefined ? null : (
      <div className="page-header__actions">{actions}</div>
    )}
  </header>
);
