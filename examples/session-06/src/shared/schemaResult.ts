import type { z } from "zod";

export type ValidationIssue = Readonly<{
  path: readonly (string | number)[];
  message: string;
}>;

export type Result<T> = Readonly<{
  isErr: () => boolean;
  isOk: () => boolean;
  _unsafeUnwrap: () => T;
  _unsafeUnwrapErr: () => readonly ValidationIssue[];
}>;

export const ok = <T>(value: T): Result<T> => ({
  isErr: () => false,
  isOk: () => true,
  _unsafeUnwrap: () => value,
  _unsafeUnwrapErr: () => {
    throw new Error("Cannot unwrap issues from a valid boundary value");
  },
});

export const err = <T>(issues: readonly ValidationIssue[]): Result<T> => ({
  isErr: () => true,
  isOk: () => false,
  _unsafeUnwrap: () => {
    throw new Error("Cannot unwrap an invalid boundary value");
  },
  _unsafeUnwrapErr: () => issues,
});

export const schemaResult = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T> => {
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? ok(parsed.data)
      : err(parsed.error.issues.map(({ path, message }) => ({
          path: [...path],
          message,
        })));
  };
