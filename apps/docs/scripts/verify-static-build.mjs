import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distUrl = new URL("../dist/", import.meta.url);
const distPath = fileURLToPath(distUrl);
const requiredHtmlFiles = [
  "index.html",
  "404.html",
  "code-explorer/index.html",
  "sessions/00-onboarding/index.html",
  "sessions/01-invariants/index.html",
  "sessions/02-state-vocabulary/index.html",
  "sessions/03-state-transitions/index.html",
  "sessions/04-awaiting-payment/index.html",
  "sessions/05-cancellation/index.html",
  "sessions/06-input-boundary/index.html",
  "sessions/07-meaningful-values/index.html",
  "sessions/08-pii-output/index.html",
  "sessions/09-typed-failures/index.html",
  "sessions/10-success-events/index.html",
  "sessions/11-use-case-ports/index.html",
  "sessions/12-atomicity-and-conflicts/index.html",
  "sessions/13-safe-follow-up/index.html",
  "sessions/final/index.html",
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
  "/code-explorer/",
  "/module-00/",
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
