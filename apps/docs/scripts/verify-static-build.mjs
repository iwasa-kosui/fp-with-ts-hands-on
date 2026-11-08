import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sessionPages = await readdir(
  new URL("../src/pages/sessions/", import.meta.url),
  { withFileTypes: true },
);
const sessionSlugs = sessionPages
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".astro") &&
      entry.name !== "index.astro",
  )
  .map((entry) => entry.name.replace(/\.astro$/, ""));

const splitSessions = {
  "03-boundaries-and-pii": {
    previous: "/sessions/02-adt-and-exhaustiveness/",
    next: "/sessions/04-workflow-errors/",
    pages: [
      "",
      "night-shift",
      "current-code",
      "boundary",
      "audit-leak",
      "result",
      "zod",
      "safe-parse",
      "branded",
      "boundary-after",
      "terms",
      "audit-record",
      "checks",
      "property-test",
      "exercise",
      "peer-review",
      "guard",
      "review",
      "payment-amount",
      "pii",
      "value-shapes",
    ],
    lastInTime: "review",
  },
};

const splitPagePath = (sessionSlug, pageSlug) =>
  pageSlug === "" ? `/sessions/${sessionSlug}/` : `/sessions/${sessionSlug}/${pageSlug}/`;

const distUrl = new URL("../dist/", import.meta.url);
const distPath = fileURLToPath(distUrl);
const requiredHtmlFiles = [
  "index.html",
  "404.html",
  "setup/index.html",
  "sessions/index.html",
  ...sessionSlugs.map((slug) => `sessions/${slug}/index.html`),
  ...Object.entries(splitSessions).flatMap(([sessionSlug, { pages }]) =>
    pages
      .filter((pageSlug) => pageSlug !== "")
      .map((pageSlug) => `sessions/${sessionSlug}/${pageSlug}/index.html`),
  ),
];

const missingHtmlFiles = [];
for (const htmlFile of requiredHtmlFiles) {
  try {
    await access(new URL(htmlFile, distUrl));
  } catch {
    missingHtmlFiles.push(htmlFile);
  }
}

if (missingHtmlFiles.length > 0) {
  throw new Error(`Missing required HTML files:\n${missingHtmlFiles.join("\n")}`);
}

const sessionPaths = requiredHtmlFiles
  .filter((htmlFile) => htmlFile.startsWith("sessions/"))
  .map((htmlFile) => `/${htmlFile.replace(/index\.html$/, "")}`);
const allowedPaths = new Set([
  "/",
  "/module-00/",
  "/setup/",
  ...sessionPaths,
]);
const htmlFiles = [];

const collectHtmlFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(target);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(target);
    }
  }
};

await collectHtmlFiles(distPath);

const builtHtmlFiles = htmlFiles.map((file) => path.relative(distPath, file)).sort();
const expectedHtmlFiles = requiredHtmlFiles.slice().sort();
const unexpectedHtmlFiles = builtHtmlFiles.filter(
  (htmlFile) => !expectedHtmlFiles.includes(htmlFile),
);

if (unexpectedHtmlFiles.length > 0) {
  throw new Error(`Unexpected built HTML files:\n${unexpectedHtmlFiles.join("\n")}`);
}

const anchorHref = (html, attribute) => {
  const tag = html.match(new RegExp(`<a\\b[^>]*\\b${attribute}[^>]*>`, "i"))?.[0];
  return tag?.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
};

const brokenNavigation = [];
for (const [sessionSlug, { pages, previous, next, lastInTime }] of Object.entries(splitSessions)) {
  for (const [index, pageSlug] of pages.entries()) {
    const htmlFile = pageSlug === ""
      ? `sessions/${sessionSlug}/index.html`
      : `sessions/${sessionSlug}/${pageSlug}/index.html`;
    const html = await readFile(new URL(htmlFile, distUrl), "utf8");
    const expectedPrevious = index === 0 ? previous : splitPagePath(sessionSlug, pages[index - 1]);
    const expectedNext = pageSlug === lastInTime || index === pages.length - 1
      ? next
      : splitPagePath(sessionSlug, pages[index + 1]);
    const actualPrevious = anchorHref(html, 'rel="prev"');
    const actualNext = anchorHref(html, 'rel="next"');
    if (actualPrevious !== expectedPrevious) {
      brokenNavigation.push(`${htmlFile}: prev ${actualPrevious} (expected ${expectedPrevious})`);
    }
    if (actualNext !== expectedNext) {
      brokenNavigation.push(`${htmlFile}: next ${actualNext} (expected ${expectedNext})`);
    }
    const lastIndex = pages.indexOf(lastInTime);
    const expectedLater = pageSlug === lastInTime && lastIndex < pages.length - 1
      ? splitPagePath(sessionSlug, pages[lastIndex + 1])
      : undefined;
    const actualLater = anchorHref(html, "data-session-later");
    if (actualLater !== expectedLater) {
      brokenNavigation.push(`${htmlFile}: later ${actualLater} (expected ${expectedLater})`);
    }
  }
}

if (brokenNavigation.length > 0) {
  throw new Error(`Unexpected previous/next links:\n${brokenNavigation.join("\n")}`);
}

const siteOrigin = "https://static.example.test";
const unresolved = [];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const href = match[2];
    if (
      href === undefined ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    const url = new URL(href, siteOrigin);
    if (url.origin !== siteOrigin || url.pathname.startsWith("/_astro/")) {
      continue;
    }

    if (!allowedPaths.has(url.pathname)) {
      unresolved.push(`${path.relative(distPath, file)}: ${href}`);
    }
  }
}

if (unresolved.length > 0) {
  throw new Error(`Unresolved internal links:\n${unresolved.join("\n")}`);
}

console.log(
  `Verified ${builtHtmlFiles.length} HTML files and ${allowedPaths.size} allowed internal routes.`,
);
