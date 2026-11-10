import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { blockOf } from "../../sessions/source-quotes";

const transitionsPath = "src/domain/appointment/transitions.ts";

export const dedent = (source: string): string => {
  const lines = source.split("\n");
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim() !== "")
      .map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};

export const lineIndexOf = (source: string, needle: string): number => {
  const index = source.split("\n").findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`"${needle}" is not in the excerpt`);
  return index;
};

type Quote = Readonly<{ path: string; code: string }>;
type Elision = readonly [firstLine: string, lastLine: string];

const elide = (block: string, elisions: readonly Elision[]): string => {
  const lines = block.split("\n");
  let from = 0;
  for (const [firstLine, lastLine] of elisions) {
    const start = lines.indexOf(firstLine, from);
    const end = lines.indexOf(lastLine, start);
    if (start < 0 || end < 0) throw new Error(`"${firstLine}" to "${lastLine}" is not in the excerpt`);
    const indent = firstLine.slice(0, firstLine.length - firstLine.trimStart().length);
    lines.splice(start, end - start + 1, `${indent}// …`);
    from = start + 1;
  }
  return lines.join("\n");
};

const quote = (
  snapshot: "session-00" | "session-01" | "session-01-solution",
  file: string,
  firstLine: string,
  lastLine: string,
  elisions: readonly Elision[] = [],
): Quote => ({
  path: `examples/${snapshot}/${file}`,
  code: dedent(elide(blockOf(projectFilesForSnapshot(snapshot), file, firstLine, lastLine), elisions)),
});

export const quotes = {
  startStartExamination: quote(
    "session-01",
    transitionsPath,
    "export const startExamination = (",
    "};",
  ),
  solutionStartExamination: quote(
    "session-01-solution",
    transitionsPath,
    "export const startExamination = (",
    "  }) as const satisfies InExamination;",
  ),
  solutionSignature: quote(
    "session-01-solution",
    transitionsPath,
    "export const startExamination = (",
    "): InExamination =>",
  ),
  solutionTypeError: quote(
    "session-01-solution",
    "test/regression/type-fixtures/paid-not-assignable-to-checked-in.ts",
    "declare const paid: Paid;",
    "startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt);",
  ),
  solutionRouteCheck: quote(
    "session-01-solution",
    "src/adaptor/primary/web/routes.ts",
    "    if (current.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");",
    "    if (current.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");",
  ),
  solutionStartRoute: quote(
    "session-01-solution",
    "src/adaptor/primary/web/routes.ts",
    '  app.post("/appointments/:appointmentId/start-examination", (context) => {',
    "    );",
    [["        ids.veterinarianId,", "    );"]],
  ),
} as const;
