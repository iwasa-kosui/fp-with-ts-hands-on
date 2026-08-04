import type { z } from "zod";
import { err, ok, type Result } from "./result.js";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<z.ZodIssue>;
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema.safeParse(raw);
    return result.success
      ? ok(result.data)
      : err({ kind: "ValidationError", issues: result.error.issues });
  };
