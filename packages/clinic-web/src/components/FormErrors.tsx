type FieldErrors = Readonly<Record<string, string>>;

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
