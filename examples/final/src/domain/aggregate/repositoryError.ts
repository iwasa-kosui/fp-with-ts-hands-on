export type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
  cause: unknown;
}>;
