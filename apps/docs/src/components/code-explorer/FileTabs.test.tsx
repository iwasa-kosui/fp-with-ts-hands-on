import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTabs } from "./FileTabs";

const roots: Root[] = [];

const mountTabs = async (paths: readonly string[]) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(
      <FileTabs
        paths={paths}
        selectedPath={paths[0] ?? ""}
        dirtyPaths={new Set()}
        disabled={false}
        onSelect={() => undefined}
      />,
    );
  });
  return host;
};

const tab = (host: HTMLElement, path: string) =>
  host.querySelector<HTMLButtonElement>(`button[data-path="${path}"]`);

describe("FileTabs", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("keeps the end of the name only on tabs whose names start with the same word", async () => {
    const host = await mountTabs([
      "eslint.config.mjs",
      "exercises/guard/mine/audit.test.ts",
      "exercises/guard/mine/audit.type-test.ts",
    ]);
    const tail = (path: string) =>
      tab(host, path)?.querySelector(".code-explorer__tab-tail");

    expect(tail("exercises/guard/mine/audit.test.ts")?.textContent).toBe(".test.ts");
    expect(tail("exercises/guard/mine/audit.type-test.ts")?.textContent).toBe(
      ".type-test.ts",
    );
    expect(
      tab(host, "exercises/guard/mine/audit.test.ts")?.querySelector("span")
        ?.textContent,
    ).toBe("audit");
    expect(tail("eslint.config.mjs")).toBeNull();
    expect(tab(host, "eslint.config.mjs")?.querySelector("span")?.textContent).toBe(
      "eslint.config.mjs",
    );
  });
});
