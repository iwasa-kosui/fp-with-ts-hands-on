import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTabs } from "./FileTabs";

const roots: Root[] = [];

const mountTabs = async (
  paths: readonly string[],
  onSelect: (path: string) => void = () => undefined,
) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(
      <FileTabs
        paths={paths}
        allPaths={paths}
        selectedPath={paths[0] ?? ""}
        dirtyPaths={new Set()}
        disabled={false}
        onSelect={onSelect}
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

  it("opens a list of every file grouped by folder without shortening names", async () => {
    const host = await mountTabs([
      "eslint.config.mjs",
      "exercises/guard/mine/audit.test.ts",
      "exercises/guard/mine/audit.type-test.ts",
    ]);
    const toggle = host.querySelector<HTMLButtonElement>(
      ".code-explorer__path-toggle",
    );
    expect(host.querySelector('[role="group"]')).toBeNull();

    await act(async () => {
      toggle?.click();
    });

    const list = host.querySelector('[role="group"]');
    expect(list).not.toBeNull();
    expect(
      [...(list?.querySelectorAll("h3") ?? [])].map((h) => h.textContent),
    ).toEqual(["プロジェクトの直下", "exercises/guard/mine/"]);
    expect(
      [...(list?.querySelectorAll("li button") ?? [])].map((b) => b.textContent),
    ).toEqual(["eslint.config.mjs", "audit.test.ts", "audit.type-test.ts"]);
  });

  it("selects the chosen file and closes the list", async () => {
    const onSelect = vi.fn();
    const host = await mountTabs(
      ["eslint.config.mjs", "exercises/guard/mine/audit.test.ts"],
      onSelect,
    );
    await act(async () => {
      host.querySelector<HTMLButtonElement>(".code-explorer__path-toggle")?.click();
    });
    await act(async () => {
      host
        .querySelector<HTMLButtonElement>(
          'button[data-file-list-path="exercises/guard/mine/audit.test.ts"]',
        )
        ?.click();
    });

    expect(onSelect).toHaveBeenCalledWith("exercises/guard/mine/audit.test.ts");
    expect(host.querySelector('[role="group"]')).toBeNull();
  });

  it("closes the list with Escape", async () => {
    const host = await mountTabs(["eslint.config.mjs"]);
    await act(async () => {
      host.querySelector<HTMLButtonElement>(".code-explorer__path-toggle")?.click();
    });
    expect(host.querySelector('[role="group"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(host.querySelector('[role="group"]')).toBeNull();
  });
});
