import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const usage =
  "Usage: node apps/docs/scripts/compare-dist.mjs [--ignore-react-ids] <before> <after>";
const maxHunksPerFile = 400;
const hunkContextTokens = 2;
const excerptLimit = 240;
const maxEditDistance = 4000;

const hashedAsset = /^(.+)\.([A-Za-z0-9_-]{8})\.([A-Za-z0-9]+)$/;
const textExtensions = new Set([
  ".html", ".js", ".mjs", ".css", ".json", ".txt", ".svg", ".map", ".xml", ".webmanifest",
]);
const blockTags = new Set([
  "html", "head", "body", "meta", "link", "title", "script", "style", "noscript", "template",
  "header", "footer", "main", "nav", "section", "article", "aside", "div", "p", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "figure", "figcaption", "details", "summary", "blockquote", "hr", "br", "form", "fieldset",
  "legend", "address", "dialog", "menu",
]);
const preservedSegments = /<(pre|script|style|textarea)\b[\s\S]*?<\/\1>/g;
const islandTag = /<astro-island\b[^>]*>/g;
const islandUrlAttributes = /\b(component-url|renderer-url|before-hydration-url)="([^"]*)"/g;

const walk = async (root, directory = root) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(root, full) : [path.relative(root, full).split(path.sep).join("/")];
    }),
  );
  return nested.flat().sort();
};

const normalizeAssetPath = (relativePath) => {
  if (!relativePath.startsWith("_astro/")) return relativePath;
  const directory = path.posix.dirname(relativePath);
  const match = hashedAsset.exec(path.posix.basename(relativePath));
  return match === null ? relativePath : `${directory}/${match[1]}.HASH.${match[3]}`;
};

const loadSide = async (root) => {
  const files = await walk(root);
  const replacements = files
    .filter((file) => normalizeAssetPath(file) !== file)
    .map((file) => [path.posix.basename(file), path.posix.basename(normalizeAssetPath(file))])
    .sort((left, right) => right[0].length - left[0].length);
  const entries = await Promise.all(
    files.map(async (file) => ({
      file,
      key: normalizeAssetPath(file),
      buffer: await readFile(path.join(root, file)),
    })),
  );
  return { entries, replacements };
};

const normalizeHashes = (text, replacements) => {
  let result = text;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
};

const stripInterTagWhitespace = (html) =>
  html.replace(/(<[^<>]*>)(\s+)(?=<)/g, (match, previousTag, _whitespace, offset) => {
    const nextTag = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(offset + match.length));
    const previousName = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(previousTag);
    const removable =
      (previousName !== null && blockTags.has(previousName[1].toLowerCase())) ||
      (nextTag !== null && blockTags.has(nextTag[1].toLowerCase()));
    return removable ? previousTag : `${previousTag} `;
  });

const normalizeReactIds = (html) =>
  html
    .replace(/(<astro-island\b[^>]*?\sprefix=)"r\d+"/g, '$1"rN"')
    .replace(/:r\d+R([^:\s"<>]*):/g, ":rNR$1:");

const normalizeHtml = (html, replacements, ignoreReactIds) => {
  const prepared = ignoreReactIds ? normalizeReactIds(html) : html;
  const hashed = normalizeHashes(prepared, replacements).replace(islandTag, (tag) =>
    tag
      .replace(/(\suid=)"[^"]*"/, '$1"UID"')
      .replace(islandUrlAttributes, (_, name, value) =>
        `${name}="${value.replace(/\.[A-Za-z0-9_-]{8}\.(m?js)\b/g, ".HASH.$1")}"`,
      ),
  );
  const segments = [];
  const masked = hashed.replace(preservedSegments, (segment) => {
    segments.push(segment);
    return `<pre data-compare-segment="${segments.length - 1}"></pre>`;
  });
  return stripInterTagWhitespace(masked).replace(
    /<pre data-compare-segment="(\d+)"><\/pre>/g,
    (_, index) => segments[Number(index)],
  );
};

const tokenizeHtml = (html) => html.split(/(<[^>]*>)/).filter((token) => token !== "");
const tokenizeCode = (code) => code.split(/(?<=[;{},\n])/).filter((token) => token !== "");

const myersDiff = (left, right) => {
  const n = left.length;
  const m = right.length;
  const max = Math.min(n + m, maxEditDistance);
  const offset = n + m + 1;
  const v = new Int32Array(2 * offset + 2);
  const trace = [];
  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && left[x] === right[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m, d);
    }
  }
  return null;
};

const backtrack = (trace, n, m, finalD) => {
  const edits = [];
  let x = n;
  let y = m;
  for (let d = finalD; d > 0; d -= 1) {
    const previous = trace[d];
    const k = x - y;
    const useInsertion =
      k === -d || (k !== d && previous[k + d] < previous[k + d + 2]);
    const previousK = useInsertion ? k + 1 : k - 1;
    const previousX = previous[previousK + d + 1];
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      edits.push({ type: "equal", left: x, right: y });
    }
    if (useInsertion) {
      y -= 1;
      edits.push({ type: "insert", left: x, right: y });
    } else {
      x -= 1;
      edits.push({ type: "delete", left: x, right: y });
    }
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    edits.push({ type: "equal", left: x, right: y });
  }
  return edits.reverse();
};

const diffHunks = (leftTokens, rightTokens) => {
  let start = 0;
  while (
    start < leftTokens.length &&
    start < rightTokens.length &&
    leftTokens[start] === rightTokens[start]
  ) start += 1;
  let leftEnd = leftTokens.length;
  let rightEnd = rightTokens.length;
  while (
    leftEnd > start &&
    rightEnd > start &&
    leftTokens[leftEnd - 1] === rightTokens[rightEnd - 1]
  ) {
    leftEnd -= 1;
    rightEnd -= 1;
  }
  const leftMiddle = leftTokens.slice(start, leftEnd);
  const rightMiddle = rightTokens.slice(start, rightEnd);
  if (leftMiddle.length === 0 && rightMiddle.length === 0) return [];
  const edits = myersDiff(leftMiddle, rightMiddle);
  if (edits === null) {
    return [{ leftStart: start, leftEnd, rightStart: start, rightEnd }];
  }
  const hunks = [];
  let current = null;
  for (const edit of edits) {
    if (edit.type === "equal") {
      if (current !== null) {
        hunks.push(current);
        current = null;
      }
      continue;
    }
    if (current === null) {
      current = {
        leftStart: start + edit.left,
        leftEnd: start + edit.left,
        rightStart: start + edit.right,
        rightEnd: start + edit.right,
      };
    }
    if (edit.type === "delete") current.leftEnd = start + edit.left + 1;
    else current.rightEnd = start + edit.right + 1;
  }
  if (current !== null) hunks.push(current);
  return hunks;
};

const clip = (text) => {
  const visible = JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"');
  return visible.length > excerptLimit
    ? `${visible.slice(0, excerptLimit / 2)} ...(${visible.length - excerptLimit} chars)... ${visible.slice(-excerptLimit / 2)}`
    : visible;
};

const reportHunks = (file, leftTokens, rightTokens) => {
  const hunks = diffHunks(leftTokens, rightTokens);
  const lines = [`DIFF ${file}: ${hunks.length} hunk(s)`];
  for (const hunk of hunks.slice(0, maxHunksPerFile)) {
    const before = leftTokens.slice(Math.max(0, hunk.leftStart - hunkContextTokens), hunk.leftStart).join("");
    const after = leftTokens.slice(hunk.leftEnd, hunk.leftEnd + hunkContextTokens).join("");
    lines.push("  ---");
    lines.push(`  context-before: ${clip(before)}`);
    lines.push(`  before: ${clip(leftTokens.slice(hunk.leftStart, hunk.leftEnd).join(""))}`);
    lines.push(`  after:  ${clip(rightTokens.slice(hunk.rightStart, hunk.rightEnd).join(""))}`);
    lines.push(`  context-after:  ${clip(after)}`);
  }
  if (hunks.length > maxHunksPerFile) {
    lines.push(`  ... ${hunks.length - maxHunksPerFile} more hunk(s)`);
  }
  return lines;
};

const args = process.argv.slice(2);
const ignoreReactIds = args.includes("--ignore-react-ids");
const [beforeRoot, afterRoot, ...rest] = args.filter((arg) => arg !== "--ignore-react-ids");
if (beforeRoot === undefined || afterRoot === undefined || rest.length > 0) {
  console.error(usage);
  process.exit(2);
}

const [before, after] = await Promise.all([loadSide(beforeRoot), loadSide(afterRoot)]);
const group = (entries) => {
  const map = new Map();
  for (const entry of entries) map.set(entry.key, [...(map.get(entry.key) ?? []), entry]);
  return map;
};
const beforeByKey = group(before.entries);
const afterByKey = group(after.entries);
const report = [];

for (const key of [...beforeByKey.keys()].sort()) {
  if (!afterByKey.has(key)) report.push(`ONLY-BEFORE ${key}`);
}
for (const key of [...afterByKey.keys()].sort()) {
  if (!beforeByKey.has(key)) report.push(`ONLY-AFTER ${key}`);
}

const normalizedText = (entry, replacements) => {
  const text = entry.buffer.toString("utf8");
  return path.posix.extname(entry.file) === ".html"
    ? normalizeHtml(text, replacements, ignoreReactIds)
    : normalizeHashes(text, replacements);
};

let compared = 0;
for (const key of [...beforeByKey.keys()].sort()) {
  const beforeEntries = beforeByKey.get(key);
  const afterEntries = afterByKey.get(key);
  if (afterEntries === undefined) continue;
  compared += 1;
  const extension = path.posix.extname(key);
  if (beforeEntries.length !== afterEntries.length) {
    report.push(`COUNT ${key}: before=${beforeEntries.length} after=${afterEntries.length}`);
    continue;
  }
  if (!textExtensions.has(extension)) {
    const beforeBinary = beforeEntries.map(({ buffer }) => buffer.toString("base64")).sort();
    const afterBinary = afterEntries.map(({ buffer }) => buffer.toString("base64")).sort();
    if (beforeBinary.join("\n") !== afterBinary.join("\n")) report.push(`DIFF ${key}: binary content differs`);
    continue;
  }
  const beforeTexts = beforeEntries.map((entry) => normalizedText(entry, before.replacements)).sort();
  const afterTexts = afterEntries.map((entry) => normalizedText(entry, after.replacements)).sort();
  beforeTexts.forEach((beforeText, index) => {
    const afterText = afterTexts[index];
    if (beforeText === afterText) return;
    const tokenize = extension === ".html" ? tokenizeHtml : tokenizeCode;
    report.push(...reportHunks(key, tokenize(beforeText), tokenize(afterText)));
  });
}

if (compared === 0) {
  console.error("比較できるファイルが両方のディレクトリにありません");
  process.exit(2);
}

if (report.length === 0) {
  console.log(`OK: ${compared} file(s) identical after normalization`);
  process.exit(0);
}
console.log(report.join("\n"));
console.log(`\nNG: differences found (${compared} file(s) compared)`);
process.exit(1);
