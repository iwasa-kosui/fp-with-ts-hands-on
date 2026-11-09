import { keyedTransformer } from "../code-cache-key";

export type Bands = Readonly<Record<string, readonly number[]>>;

export const lineIndex = (code: string, needle: string): number => {
  const found = code
    .split("\n")
    .flatMap((line, index) => (line.includes(needle) ? [index] : []));
  if (found.length !== 1) {
    throw new Error(`行が一意に見つかりません: ${needle} (${found.length}件)`);
  }
  return found[0] as number;
};

export const lineIs = (code: string, text: string): number => {
  const found = code
    .split("\n")
    .flatMap((line, index) => (line.trim() === text ? [index] : []));
  if (found.length !== 1) {
    throw new Error(`行が一意に見つかりません: ${text} (${found.length}件)`);
  }
  return found[0] as number;
};

export const lineRange = (code: string, first: string, last: string): readonly number[] => {
  const from = lineIndex(code, first);
  const lines = code.split("\n");
  const to = lines.findIndex((line, index) => index >= from && line.includes(last));
  if (to < 0) throw new Error(`範囲の末尾が見つかりません: ${last}`);
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
};

export const lineCount = (code: string): number => code.split("\n").length;

export const checkBands = (
  code: string,
  bands: Readonly<Record<string, readonly number[] | undefined>>,
): Bands => {
  const count = lineCount(code);
  const checked: Record<string, readonly number[]> = {};
  Object.entries(bands).forEach(([band, indexes]) => {
    if (indexes === undefined) return;
    indexes.forEach((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new Error(`強調する行 ${index} (${band}) がコードの範囲外です`);
      }
    });
    checked[band] = indexes;
  });
  return checked;
};

export const bandMeta = (bands: Bands): string =>
  Object.entries(bands)
    .map(([band, indexes]) => `${band}:${indexes.join(",")}`)
    .join(";");

const parseBandMeta = (raw: string): ReadonlyMap<number, string> => {
  const byLine = new Map<number, string>();
  raw.split(";").forEach((entry) => {
    const [band, list = ""] = entry.split(":");
    if (band === undefined || band === "") return;
    list.split(",").forEach((index) => {
      if (index !== "") byLine.set(Number(index) + 1, band);
    });
  });
  return byLine;
};

export const bandTransformer = keyedTransformer("workflow-errors-band", {
  name: "workflow-errors-band",
  line(
    this: { options: { meta?: { __raw?: string } } },
    node: { properties: Record<string, unknown> },
    line: number,
  ) {
    const band = parseBandMeta(this.options.meta?.__raw ?? "").get(line);
    if (band !== undefined) node.properties["data-band"] = band;
  },
});

export const dedent = (code: string): string => {
  const lines = code.split("\n");
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== "").map((line) => line.search(/\S/)),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};

export const excerptBetween = (code: string, first: string, endBefore: string): string => {
  const lines = code.split("\n");
  const from = lineIndex(code, first);
  const end = lineIndex(code, endBefore);
  if (end <= from) throw new Error(`範囲が逆です: ${first} / ${endBefore}`);
  const picked = lines.slice(from, end);
  while (picked.length > 0 && (picked[picked.length - 1] as string).trim() === "") picked.pop();
  return dedent(picked.join("\n"));
};

export const lineAll = (code: string, needle: string): readonly number[] => {
  const found = code
    .split("\n")
    .flatMap((line, index) => (line.includes(needle) ? [index] : []));
  if (found.length === 0) throw new Error(`行が見つかりません: ${needle}`);
  return found;
};

export const lineSlice = (code: string, from: number, to: number): string => {
  const lines = code.split("\n");
  if (from < 0 || to < from || to >= lines.length) throw new Error(`行の範囲が不正です: ${from}-${to}`);
  return dedent(lines.slice(from, to + 1).join("\n"));
};
