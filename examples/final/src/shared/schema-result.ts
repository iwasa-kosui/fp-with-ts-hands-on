import type { StandardSchemaV1 } from "@standard-schema/spec";
import { err, ok, type Result } from "neverthrow";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

export const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const parsed = schema["~standard"].validate(raw);
    if (parsed instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }

    return parsed.issues === undefined
      ? ok(parsed.value)
      : err({ kind: "ValidationError", issues: parsed.issues });
  };
