import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { blockOf } from "../../sessions/source-quotes";

const appointmentPath = "src/domain/appointment/appointment.ts";
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

const quote = (
  snapshot: "session-00" | "session-01" | "session-01-solution",
  file: string,
  firstLine: string,
  lastLine: string,
): Quote => ({
  path: `examples/${snapshot}/${file}`,
  code: dedent(blockOf(projectFilesForSnapshot(snapshot), file, firstLine, lastLine)),
});

export const quotes = {
  distributedType: quote(
    "session-00",
    appointmentPath,
    "export type Appointment = Readonly<{",
    "  examinationStartedAt?: string;",
  ),
  startInExaminationType: quote(
    "session-01",
    appointmentPath,
    "export type InExamination = Readonly<{",
    "}>;",
  ),
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
    "test/regression/type-fixtures/paid-cannot-start.ts",
    "declare const paid: Paid;",
    "startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt);",
  ),
  solutionRouteCheck: quote(
    "session-01-solution",
    "src/web/routes.ts",
    "    if (current.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");",
    "    if (current.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");",
  ),
} as const;
