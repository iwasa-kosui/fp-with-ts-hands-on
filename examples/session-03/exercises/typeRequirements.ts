import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileProjectFile, compileTypeFixture } from "./compileTypeFixture.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const testTypesRelativePath = "src/domain/domain.test-types.ts";

const assertTypeRequirement = (
  requirement: string,
  diagnostics: ReadonlyArray<string>,
): void => {
  if (diagnostics.length === 0) return;
  throw new Error(`型で守れていません: ${requirement}\n${diagnostics.join("\n")}`);
};

export const assertAppointmentAndVeterinarianIdsCannotBeMixed = (): void => {
  assertTypeRequirement(
    "予約と獣医師の識別子を取り違えられない",
    compileTypeFixture("s3-appointment-id-is-not-veterinarian-id.ts"),
  );
};

export const assertStartExaminationRequiresPurposeSpecificIds = (): void => {
  assertTypeRequirement(
    "診察開始には予約と獣医師の識別子が必要",
    compileTypeFixture("s3-start-examination-requires-typed-ids.ts"),
  );
};

export const assertInvalidIdentifierAssignmentsAreRejected = (): void => {
  const source = readFileSync(
    path.resolve(directory, "..", testTypesRelativePath),
    "utf8",
  );
  const expectedErrorCount = (source.match(/@ts-expect-error/g) ?? []).length;
  const requirement = "不正な識別子の取り違えを少なくとも2か所で止める";
  const diagnostics = compileProjectFile(testTypesRelativePath);

  if (expectedErrorCount < 2) {
    const compilerDiagnostics =
      diagnostics.length === 0
        ? "compiler diagnostics: ありません"
        : `compiler diagnostics:\n${diagnostics.join("\n")}`;
    throw new Error(
      `型で守れていません: ${requirement}\n${compilerDiagnostics}\n型検査が2件未満です: ${expectedErrorCount}件`,
    );
  }

  assertTypeRequirement(requirement, diagnostics);
};
