import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<z.ZodIssue>;
}>;

export const schemaResult = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "ValidationError", issues: parsed.error.issues });
  };
