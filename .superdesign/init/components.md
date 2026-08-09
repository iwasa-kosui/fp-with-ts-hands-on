# Shared UI components

The application currently has no component library. Its only shared UI primitive is the form error display below; buttons, inputs, cards, badges, tables, and empty states are rendered directly by pages.

## `examples/final/src/adaptor/primary/web/components/FormErrors.tsx`

Exports `ErrorSummary` and `FieldError`. Both consume the allowlisted `FieldErrors` page prop.

```tsx
import type { FieldErrors } from "../pageProps.js";

export const ErrorSummary = ({ errors }: Readonly<{ errors: FieldErrors }>) => {
  const entries = Object.entries(errors);
  return entries.length === 0 ? null : (
    <div
      aria-label="入力エラー"
      aria-live="polite"
      className="error-summary"
      role="alert"
    >
      <p>操作を完了できませんでした。次の内容を確認してください。</p>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </div>
  );
};

export const FieldError = ({
  field,
  message,
}: Readonly<{ field: string; message: string | undefined }>) =>
  message === undefined ? null : (
    <p className="error" id={`${field}-error`} role="alert">
      {message}
    </p>
  );
```
