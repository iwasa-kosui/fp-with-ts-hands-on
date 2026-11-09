import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { sourceOf } from "../../sessions/source-quotes";
import type { ExampleSnapshot } from "../../sessions/types";

export type Part = Readonly<{ from: string; to?: string }> | "…";
type Excerpt = Readonly<{ snapshot: ExampleSnapshot; path: string; parts: readonly Part[] }>;

const indentOf = (line: string): number => line.length - line.trimStart().length;

export const excerptOf = ({ snapshot, path, parts }: Excerpt): Readonly<{ code: string; label: string }> => {
  const lines = sourceOf(projectFilesForSnapshot(snapshot), path).split("\n");
  let previousEnd = -1;
  const blocks = parts.map((part) => {
    if (part === "…") return null;
    const hits = lines.flatMap((line, index) => (line.trim() === part.from ? [index] : []));
    const start = hits.length === 1 ? hits[0] : hits.find((index) => index > previousEnd);
    const end = start === undefined ? -1 : lines.findIndex((line, index) => index >= start && line.trim() === (part.to ?? part.from));
    if (start === undefined || end < 0) throw new Error(`${snapshot}/${path} has no line "${part.from}"`);
    previousEnd = end;
    return { start, end };
  });
  const shown = blocks.flatMap((block) => (block === null ? [] : lines.slice(block.start, block.end + 1)));
  const indent = Math.min(...shown.filter((line) => line.trim() !== "").map(indentOf));
  const code = blocks.map((block, index) => {
    if (block !== null) return lines.slice(block.start, block.end + 1).map((line) => line.slice(indent)).join("\n");
    const next = blocks.slice(index + 1).find((candidate) => candidate !== null);
    const previous = blocks.slice(0, index).reverse().find((candidate) => candidate !== null);
    const pad = next !== undefined && next !== null
      ? indentOf(lines[next.start]) - indent
      : previous === undefined || previous === null
        ? 0
        : indentOf(lines[previous.end]) - indent + (lines[previous.end].trimEnd().endsWith("{") ? 2 : 0);
    return `${" ".repeat(Math.max(0, pad))}…`;
  }).join("\n");
  const merged = blocks.flatMap((block) => (block === null ? [] : [block])).reduce<{ start: number; end: number }[]>((acc, block) => {
    const last = acc[acc.length - 1];
    if (last !== undefined && last.end + 1 === block.start) return [...acc.slice(0, -1), { start: last.start, end: block.end }];
    return [...acc, block];
  }, []);
  const ranges = merged.map((block) => (block.start === block.end ? `${block.start + 1}` : `${block.start + 1}-${block.end + 1}`));
  return { code, label: `examples/${snapshot}/${path}:${ranges.join(", ")}` };
};
