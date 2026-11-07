import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const KNOWN_BROKEN_REDIRECTS = [];

const BASELINE_PATHS = [
  "/",
  "/sessions/",
  "/sessions/00-system-handover/",
  "/sessions/01-state-transitions/",
  "/sessions/02-adt-and-exhaustiveness/",
  "/sessions/03-semantic-identifiers/",
  "/sessions/03-boundaries-and-pii/",
  "/sessions/04-workflow-errors/",
  "/sessions/05-business-events-and-workflows/",
  "/sessions/06-effects-and-consistency/",
  "/sessions/final/",
  "/setup/",
  "/module-00",
  "/module-00/",
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
  "/sessions/00-onboarding/",
  "/sessions/01-state-modeling/",
  "/sessions/02-boundary-and-ids/",
  "/sessions/03-result-errors/",
  "/sessions/04-effects-and-events/",
  "/sessions/04-agent-review",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration",
  "/sessions/05-mini-integration/",
  "/sessions/03-semantic-identifiers",
  "/sessions/01-business-events-and-workflows/",
  "/sessions/02-state-transitions/",
  "/sessions/03-adt-and-exhaustiveness/",
  "/sessions/04-boundaries-and-pii/",
  "/sessions/05-workflow-errors/",
];

const ALLOWED_DYNAMIC_ROUTES = [];

const PAGE_EXTENSIONS = [".astro", ".md", ".mdx", ".html"];
const EXCLUDED_PAGES = ["404"];
const REQUEST_TIMEOUT_MS = 15000;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = join(rootDir, "apps", "docs", "src", "pages");
const routesFile = join(rootDir, "worker", "routes.ts");

const usage = "使い方: node scripts/verify-urls.mjs <base-url>";

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const baseArg = process.argv[2];
if (baseArg === undefined || process.argv.length > 3) fail(usage);

let base;
try {
  base = new URL(baseArg);
} catch {
  fail(`base-url を URL として読めません: ${baseArg}\n${usage}`);
}
if (base.protocol !== "http:" && base.protocol !== "https:") {
  fail(`base-url は http または https で指定してください: ${baseArg}`);
}

const loadRedirectRoutes = async () => {
  try {
    const module = await import(pathToFileURL(routesFile).href);
    if (!Array.isArray(module.redirectRoutes)) {
      throw new Error("redirectRoutes が配列ではありません");
    }
    return module.redirectRoutes;
  } catch (error) {
    return fail(
      [
        `worker/routes.ts を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`,
        `現在の Node は ${process.version} です。TypeScript をそのまま読むには、Node 22.18 以上、または 23.6 以上が必要です。`,
        "Node 22.6 以上 22.18 未満では、--experimental-strip-types を付けて実行してください。",
      ].join("\n"),
    );
  }
};

const collectPageFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? collectPageFiles(join(dir, entry.name))
      : [join(dir, entry.name)],
  );

const collectPages = () => {
  const pages = [];
  const skipped = [];
  const disallowedDynamic = [];
  for (const file of collectPageFiles(pagesDir)) {
    const relativePath = relative(pagesDir, file).split(sep).join("/");
    const fileName = relativePath.split("/").at(-1);
    if (fileName.startsWith("_")) continue;
    const extension = PAGE_EXTENSIONS.find((candidate) =>
      relativePath.endsWith(candidate),
    );
    if (extension === undefined) {
      skipped.push({ source: relativePath, reason: "ページ以外のファイル" });
      continue;
    }
    const route = relativePath.slice(0, -extension.length);
    if (route.includes("[")) {
      if (ALLOWED_DYNAMIC_ROUTES.includes(relativePath)) {
        skipped.push({ source: relativePath, reason: "動的ルート" });
      } else {
        disallowedDynamic.push(relativePath);
      }
      continue;
    }
    if (EXCLUDED_PAGES.includes(route)) continue;
    const segments = route.split("/");
    if (segments.at(-1) === "index") segments.pop();
    pages.push({
      source: relativePath,
      pathname: segments.length === 0 ? "/" : `/${segments.join("/")}/`,
    });
  }
  pages.sort((a, b) => a.pathname.localeCompare(b.pathname));
  return { pages, skipped, disallowedDynamic };
};

const responseCache = new Map();

const request = (url) => {
  const key = url.href;
  if (!responseCache.has(key)) {
    responseCache.set(
      key,
      fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }).then(
        async (response) => ({
          status: response.status,
          location: response.headers.get("location"),
          body: await response.text(),
        }),
        (error) => ({
          status: null,
          location: null,
          body: "",
          error: error instanceof Error ? (error.cause?.code ?? error.message) : String(error),
        }),
      ),
    );
  }
  return responseCache.get(key);
};

const describeStatus = (response) =>
  response.status === null ? `接続失敗(${response.error})` : String(response.status);

const resolveLocation = (location, from) => {
  try {
    return new URL(location, from);
  } catch {
    return null;
  }
};

const rows = [];
const notes = [];

const addRow = (url, expected, actual, verdict) => {
  rows.push({ url, expected, actual, verdict });
};

const checkPage = async (pathname) => {
  const response = await request(new URL(pathname, base));
  const ok = response.status === 200;
  addRow(pathname, "200", describeStatus(response), ok ? "OK" : "NG");
};

const checkHealth = async () => {
  const response = await request(new URL("/healthz", base));
  const ok = response.status === 200 && response.body.trim() === "ok";
  const actual =
    response.status === 200
      ? `200 本文=${JSON.stringify(response.body.trim().slice(0, 30))}`
      : describeStatus(response);
  addRow("/healthz", '200 本文="ok"', actual, ok ? "OK" : "NG");
};

const checkRedirect = async ({ pathname, location }) => {
  const source = new URL(pathname, base);
  const expectedTarget = new URL(location, base);
  const expectedText = `308 -> ${location} -> 200`;
  const response = await request(source);

  if (response.status !== 308) {
    addRow(pathname, expectedText, describeStatus(response), "NG");
    return;
  }
  if (response.location === null) {
    addRow(pathname, expectedText, "308 Location なし", "NG");
    return;
  }
  const actualTarget = resolveLocation(response.location, source);
  if (actualTarget === null || actualTarget.href !== expectedTarget.href) {
    addRow(pathname, expectedText, `308 -> ${response.location}`, "NG");
    return;
  }

  const destination = await request(actualTarget);
  const destinationPath = actualTarget.pathname;
  const known = KNOWN_BROKEN_REDIRECTS.includes(pathname);
  const shownLocation =
    actualTarget.origin === base.origin
      ? `${actualTarget.pathname}${actualTarget.search}`
      : actualTarget.href;
  const prefix = `308 -> ${shownLocation} -> `;

  if (destination.status === 200) {
    if (known) {
      notes.push(
        `${pathname} の宛先 ${destinationPath} は 200 になりました。scripts/verify-urls.mjs の KNOWN_BROKEN_REDIRECTS から ${pathname} を消してください。`,
      );
      addRow(pathname, expectedText, `${prefix}200 (KNOWN_BROKEN_REDIRECTS から消す)`, "NG");
      return;
    }
    addRow(pathname, expectedText, `${prefix}200`, "OK");
    return;
  }
  if (destination.status !== null && destination.status >= 300 && destination.status < 400) {
    addRow(
      pathname,
      expectedText,
      `${prefix}${destination.status} -> ${destination.location ?? "?"} (連鎖)`,
      "NG",
    );
    return;
  }
  if (destination.status === 404 && known) {
    addRow(pathname, expectedText, `${prefix}404`, "既知");
    return;
  }
  addRow(pathname, expectedText, `${prefix}${describeStatus(destination)}`, "NG");
};

const displayWidth = (text) =>
  [...text].reduce((width, char) => {
    const code = char.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    return width + (wide ? 2 : 1);
  }, 0);

const pad = (text, width) => text + " ".repeat(Math.max(0, width - displayWidth(text)));

const printTable = (header, tableRows) => {
  const all = [header, ...tableRows];
  const widths = header.map((_, column) =>
    Math.max(...all.map((row) => displayWidth(row[column]))),
  );
  const line = (row) => row.map((cell, column) => pad(cell, widths[column])).join("  ");
  console.log(line(header));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of tableRows) console.log(line(row));
};

const main = async () => {
  const redirectRoutes = await loadRedirectRoutes();
  const { pages, skipped, disallowedDynamic } = collectPages();

  console.log(`対象: ${base.href}`);
  console.log(`ページ ${pages.length} 件、リダイレクト ${redirectRoutes.length} 件`);
  for (const item of skipped) {
    console.log(`対象外: apps/docs/src/pages/${item.source} (${item.reason})`);
  }
  console.log("");

  for (const source of disallowedDynamic) {
    addRow(
      `apps/docs/src/pages/${source}`,
      "動的ルートは ALLOWED_DYNAMIC_ROUTES に載せたものだけ",
      "許可されていない動的ルート",
      "NG",
    );
  }

  const currentPaths = new Set([
    ...pages.map((page) => page.pathname),
    ...redirectRoutes.map((route) => route.pathname),
  ]);
  for (const path of BASELINE_PATHS) {
    if (!currentPaths.has(path)) {
      addRow(
        path,
        "ページかリダイレクトとして存在する",
        "ページにもリダイレクトにもない",
        "NG",
      );
    }
  }

  const redirectPaths = new Set(redirectRoutes.map((route) => route.pathname));
  for (const path of KNOWN_BROKEN_REDIRECTS) {
    if (!redirectPaths.has(path)) {
      notes.push(
        `${path} は redirectRoutes にありません。scripts/verify-urls.mjs の KNOWN_BROKEN_REDIRECTS から消してください。`,
      );
      addRow(path, "redirectRoutes に存在する", "redirectRoutes にない", "NG");
    }
  }

  for (const page of pages) await checkPage(page.pathname);
  await checkHealth();
  for (const route of redirectRoutes) await checkRedirect(route);

  printTable(
    ["URL", "期待", "実際", "判定"],
    rows.map((row) => [row.url, row.expected, row.actual, row.verdict]),
  );

  for (const note of new Set(notes)) console.log(`\n${note}`);

  const count = (verdict) => rows.filter((row) => row.verdict === verdict).length;
  console.log(
    `\n合計 ${rows.length} 件: OK ${count("OK")} / 既知 ${count("既知")} / NG ${count("NG")} / 対象外 ${skipped.length}`,
  );
  process.exitCode = count("NG") > 0 ? 1 : 0;
};

await main();
