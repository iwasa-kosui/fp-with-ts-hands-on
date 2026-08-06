import { useState } from "react";

export const CopyButton = ({ value }: Readonly<{ value: string }>) => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="copy-button" onClick={copy} aria-live="polite">
      {copied ? "コピーしました" : "コピーする"}
    </button>
  );
};
