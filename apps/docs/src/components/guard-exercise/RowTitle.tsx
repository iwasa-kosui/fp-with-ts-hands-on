import { Fragment } from "react";
import { titleSegments } from "./labels";

export const RowTitle = ({ title }: Readonly<{ title: string }>) => (
  <>
    {titleSegments(title).map((segment, index) => (
      <Fragment key={index}>
        {index === 0 ? null : <wbr />}
        {segment}
      </Fragment>
    ))}
  </>
);
