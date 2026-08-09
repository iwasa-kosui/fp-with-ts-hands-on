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
export type UnauthorizedDisclosureError = Readonly<{
  kind: "UnauthorizedDisclosure";
}>;

export type PublicOperationErrorKind =
  | "VeterinarianScheduleConflict"
  | "StaleAppointmentVersion"
  | "InvalidAppointmentStateEdit"
  | "DepositNotAllowed"
  | "DepositAlreadyReceived"
  | "UnassignedOrDifferentVeterinarian"
  | "SettlementConflict"
  | "UnauthorizedDisclosure"
  | "RepositoryError";

export type WebUseCaseError =
  | ValidationError
  | UnauthenticatedError
  | UnauthorizedError
  | UnauthorizedDisclosureError
  | NotFoundError
  | ConflictError
  | RepositoryFailure;

export const assertNever = (_value: never): never => {
  throw new TypeError("Unhandled web error");
};

export const publicOperationErrorMessage = (
  kind: PublicOperationErrorKind,
): string => {
  switch (kind) {
    case "VeterinarianScheduleConflict":
      return "選択した時間帯には、この獣医師の別の予約があります。";
    case "StaleAppointmentVersion":
      return "別の端末で予約が更新されました。最新の内容を確認してください。";
    case "InvalidAppointmentStateEdit":
      return "受付後の予約内容は変更できません。";
    case "DepositNotAllowed":
      return "事前会計は予防接種の予約だけで利用できます。";
    case "DepositAlreadyReceived":
      return "この予約の前受金はすでに登録されています。";
    case "UnassignedOrDifferentVeterinarian":
      return "この予約を診察開始できるのは、担当獣医師または管理者です。";
    case "SettlementConflict":
      return "会計情報が更新されています。金額を確認し直してください。";
    case "UnauthorizedDisclosure":
      return "この監査情報を表示する権限がありません。";
    case "RepositoryError":
      return "処理を完了できませんでした。時間をおいて再度お試しください。";
    default:
      return assertNever(kind);
  }
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
    case "UnauthorizedDisclosure":
      return context.text(publicOperationErrorMessage(error.kind), 403);
    case "NotFound":
      return context.text("Not Found", 404);
    case "Conflict":
      return context.text("Conflict", 409);
    case "RepositoryError":
      return context.text(publicOperationErrorMessage(error.kind), 500);
    default:
      return assertNever(error);
  }
};
