import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import HomePage from "../../pages/index.astro";

describe("home page", () => {
  it("preserves the WAN NYAN landing page structure and content", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomePage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector(".home-page.wan-nyan-home")).not.toBeNull();
    expect(document.querySelector(".landing-header")).not.toBeNull();
    expect(document.querySelector(".system-window")).not.toBeNull();
    expect(document.querySelectorAll(".splat-card")).toHaveLength(7);
    expect(document.querySelectorAll(".time-stop")).toHaveLength(7);
    expect(document.querySelector("h1")?.textContent).toContain("WAN NYAN");
    expect(document.querySelector('a[href="/modules/00-break-the-app/"]')).not.toBeNull();
  });
});
