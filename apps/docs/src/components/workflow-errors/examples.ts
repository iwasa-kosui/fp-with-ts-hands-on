export const doubleCode = "const double = (v: number): number => v * 2;";

export const ensurePositiveCode = `const ensurePositive = (
  v: number,
): Result<number, "NotPositive"> =>
  v > 0 ? ok(v) : err("NotPositive");`;

export const mapSketch = `const map = <T, U, E>(
  r: Result<T, E>,
  f: (v: T) => U,
) => r.isOk()
  ? ok(f(r.value))
  : err(r.error);`;

export const andThenSketch = `const andThen = <T, U, E1, E2>(
  r: Result<T, E1>,
  f: (v: T) => Result<U, E2>,
): Result<U, E1 | E2> => r.isOk()
  ? f(r.value)
  : err(r.error);`;

export const mapFlowCode = [doubleCode, mapSketch].join("\n\n");

export const mapFlowCodeWithEnsure = [doubleCode, ensurePositiveCode, mapSketch].join("\n\n");

export const andThenFlowCode = [ensurePositiveCode, mapSketch, andThenSketch].join("\n\n");
