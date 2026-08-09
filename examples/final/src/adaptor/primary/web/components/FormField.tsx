import type { PropsWithChildren, ReactElement } from "react";

import { FieldError } from "./FormErrors.js";

type FormFieldProps = PropsWithChildren<
  Readonly<{
    description?: string;
    error?: string;
    field: string;
    label: string;
  }>
>;

export const FormField = ({
  children,
  description,
  error,
  field,
  label,
}: FormFieldProps): ReactElement => (
  <div className="form-field">
    <label className="form-field__label" htmlFor={field}>{label}</label>
    {description === undefined ? null : (
      <p className="form-field__description">{description}</p>
    )}
    {children}
    <FieldError field={field} message={error} />
  </div>
);
