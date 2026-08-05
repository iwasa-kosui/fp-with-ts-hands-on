import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("copies the exact command and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<CopyButton value="pnpm test -- --runInBand" />));
    await act(async () => host.querySelector("button")?.click());

    expect(writeText).toHaveBeenCalledWith("pnpm test -- --runInBand");
    expect(host.querySelector("button")).toMatchObject({
      type: "button",
      className: "copy-button",
    });
    expect(host.querySelector("button")?.getAttribute("aria-live")).toBe("polite");
    expect(host.textContent).toContain("コピーしました");
  });

  it("keeps the retry label when clipboard access fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<CopyButton value="pnpm test" />));
    await act(async () => host.querySelector("button")?.click());

    expect(host.textContent).toContain("コピーする");
    expect(host.textContent).not.toContain("コピーしました");
  });
});
