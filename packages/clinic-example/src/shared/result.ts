export type Ok<T> = Readonly<{ kind: "Ok"; value: T }>;
export type Err<E> = Readonly<{ kind: "Err"; error: E }>;
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ kind: "Ok", value });
export const err = <E>(error: E): Err<E> => ({ kind: "Err", error });
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.kind === "Ok";
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.kind === "Err";
export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  isOk(result) ? ok(fn(result.value)) : result;
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (isOk(result) ? fn(result.value) : result);
