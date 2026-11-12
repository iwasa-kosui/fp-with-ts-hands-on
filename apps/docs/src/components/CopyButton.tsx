import { useState } from "react";

export const CopyButton = ({ value, label }: Readonly<{ value: string; label?: string }>) => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const text = copied ? "コピーしました" : "コピーする";

  return (
    <button
      type="button"
      className="copy-button"
      onClick={copy}
      aria-live="polite"
      aria-label={label === undefined ? undefined : `${label}を${text}`}
    >
      {text}
    </button>
  );
};
