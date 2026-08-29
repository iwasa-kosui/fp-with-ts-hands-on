import { compileWithAdditionalStartExaminationError } from "../test/regression/compileTypeFixture.js";

export const assertAllStartExaminationErrorsAreHandled = (): void => {
  const diagnostics = compileWithAdditionalStartExaminationError();
  if (diagnostics.length === 0) return;
  throw new Error(
    `型で守れていません: 新しい業務エラーを未処理のままにできない\n${diagnostics.join("\n")}`,
  );
};
