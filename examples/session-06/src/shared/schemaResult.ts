import type { z } from "zod";

export type Result<T> = Readonly<{
  isErr: () => boolean;
  isOk: () => boolean;
  _unsafeUnwrap: () => T;
}>;

export const ok = <T>(value: T): Result<T> => ({
  isErr: () => false,
  isOk: () => true,
  _unsafeUnwrap: () => value,
});

export const err = <T>(): Result<T> => ({
  isErr: () => true,
  isOk: () => false,
  _unsafeUnwrap: () => {
    throw new Error("Cannot unwrap an invalid boundary value");
  },
});

export const schemaResult = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T> => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? ok(parsed.data) : err();
  };
