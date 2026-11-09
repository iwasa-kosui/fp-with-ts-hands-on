import { err, ok, type Result } from "neverthrow";
import type { z } from "zod";

export type SchemaValidationError = Readonly<{
  kind: "SchemaValidationError";
  issues: readonly z.ZodIssue[];
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T, SchemaValidationError> => {
    const parsed = schema.safeParse(raw);

    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "SchemaValidationError", issues: parsed.error.issues });
  };
