import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Context } from "hono";

import type { FieldErrors } from "../pageProps.js";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  errors: FieldErrors;
}>;
export type UnauthenticatedError = Readonly<{
  kind: "Unauthenticated";
}>;
export type UnauthorizedError = Readonly<{ kind: "Unauthorized" }>;
export type NotFoundError = Readonly<{ kind: "NotFound" }>;
export type ConflictError = Readonly<{ kind: "Conflict" }>;
export type RepositoryFailure = Readonly<{ kind: "RepositoryError" }>;

export type WebUseCaseError =
  | ValidationError
  | UnauthenticatedError
  | UnauthorizedError
  | NotFoundError
  | ConflictError
  | RepositoryFailure;

export const assertNever = (_value: never): never => {
  throw new TypeError("Unhandled web error");
};

export const issuesToFieldErrors = (
  issues: readonly StandardSchemaV1.Issue[],
): FieldErrors =>
  Object.fromEntries(
    issues.map((issue) => {
      const firstPathSegment = issue.path?.[0];
      const field =
        typeof firstPathSegment === "string"
          ? firstPathSegment
          : typeof firstPathSegment === "object" &&
              firstPathSegment !== null &&
              "key" in firstPathSegment
            ? String(firstPathSegment.key)
            : "form";
      return [field, "入力内容を確認してください"];
    }),
  );

export const respondToUseCaseError = (
  context: Context,
  error: WebUseCaseError,
  options: Readonly<{
    validation?: (errors: FieldErrors) => Response;
  }> = {},
): Response => {
  switch (error.kind) {
    case "ValidationError":
      return options.validation === undefined
        ? context.json({ errors: error.errors }, 422)
        : options.validation(error.errors);
    case "Unauthenticated":
      return context.redirect("/login");
    case "Unauthorized":
      return context.text("Forbidden", 403);
    case "NotFound":
      return context.text("Not Found", 404);
    case "Conflict":
      return context.text("Conflict", 409);
    case "RepositoryError":
      return context.text("Internal Server Error", 500);
    default:
      return assertNever(error);
  }
};
