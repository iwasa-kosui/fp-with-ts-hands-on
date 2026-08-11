import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export type SchemaValidationError = Readonly<{
  kind: "SchemaValidationError";
  issues: readonly z.ZodIssue[];
}>;

export const schemaResult = <TSchema extends z.ZodType>(schema: TSchema) =>
  (raw: unknown): Result<z.output<TSchema>, SchemaValidationError> => {
    const parsed = schema.safeParse(raw);

    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "SchemaValidationError", issues: parsed.error.issues });
  };
