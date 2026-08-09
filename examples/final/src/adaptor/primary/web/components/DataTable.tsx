import type { PropsWithChildren, ReactElement } from "react";

type DataTableProps = PropsWithChildren<Readonly<{ label: string }>>;

export const DataTable = ({ children, label }: DataTableProps): ReactElement => (
  <div className="data-table-scroll">
    <table aria-label={label}>{children}</table>
  </div>
);
