import type { Session } from "../../../domain/session/session.js";
import type { User } from "../../../domain/user/user.js";

export type AuthenticatedUserView = Readonly<{
  userId: User["userId"];
  role: User["kind"];
}>;

export type AuthenticatedActor = Readonly<{
  user: User;
  session: Session;
}>;

export type FieldErrors = Readonly<Record<string, string>>;

export type SharedPageProps = Readonly<{
  auth: Readonly<{ user: AuthenticatedUserView | null }>;
  flash: Readonly<{ message?: string }>;
  errors: FieldErrors;
}>;

export type WebVariables = Readonly<{
  actor: AuthenticatedActor | undefined;
  sharedProps: SharedPageProps;
}>;

export type ViteHtmlTransformer = Readonly<{
  transformIndexHtml: (url: string, html: string) => Promise<string>;
}>;

export type WebEnvironment = Readonly<{
  Bindings: Readonly<{
    vite?: ViteHtmlTransformer;
  }>;
  Variables: WebVariables;
}>;

export const toAuthenticatedUserView = (
  user: User,
): AuthenticatedUserView => ({
  userId: user.userId,
  role: user.kind,
});
