import { describe, expect, it } from "vitest";
import { episodeScenes } from "./episode-scenes";

const slugs = [
  "00-system-handover",
  "01-state-transitions",
  "02-adt-and-exhaustiveness",
  "03-boundaries-and-pii",
  "04-workflow-errors",
  "05-business-events-and-workflows",
  "06-effects-and-consistency",
  "final",
] as const;

const proseSources = import.meta.glob<string>("../sessions/prose/*.mdx", {
  eager: true,
  query: "?raw",
  import: "default",
});
const pageSources = import.meta.glob<string>(
  ["../pages/sessions/*.astro", "!../pages/sessions/index.astro"],
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);

describe("episodeScenes", () => {
  it.each(slugs)("%s に空でない label と art がある", (slug) => {
    const scene: { label: string; art: string } = episodeScenes[slug];

    expect(scene.label.trim()).not.toBe("");
    expect(scene.art.trim()).not.toBe("");
  });

  it.each(slugs)("%s の MDX が EpisodeIllustration を置いている", (slug) => {
    const source = proseSources[`../sessions/prose/${slug}.mdx`];

    expect(source).toContain("  <EpisodeIllustration slug={props.session.slug} />");
  });

  it.each(slugs)("%s のページが Prose の components に EpisodeIllustration を渡している", (slug) => {
    const source = pageSources[`../pages/sessions/${slug}.astro`];

    expect(source).toMatch(/<Prose\s[^>]*components=\{\{[^}]*\bEpisodeIllustration\b[^}]*\}\}/);
  });
});
