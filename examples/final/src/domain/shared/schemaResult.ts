import type { StandardSchemaV1 } from "@standard-schema/spec";
import { err, ok, type Result } from "neverthrow";

export type SchemaValidationError = Readonly<{
  kind: "SchemaValidationError";
  issues: readonly StandardSchemaV1.Issue[];
}>;

export const schemaResult =
  <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, SchemaValidationError> => {
    const result = schema["~standard"].validate(raw);

    if (result instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }

    return result.issues === undefined
      ? ok(result.value)
      : err({ kind: "SchemaValidationError", issues: result.issues });
  };
