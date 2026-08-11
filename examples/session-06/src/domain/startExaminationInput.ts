export type SchemaValidationError = Readonly<{
  kind: "SchemaValidationError";
  issues: readonly string[];
}>;

export type StartExaminationInput = Readonly<{
  appointmentId: string;
  veterinarianId: string;
  startedAt: string;
}>;

export type StartExaminationInputResult = Readonly<{
  isErr: () => boolean;
  _unsafeUnwrapErr: () => SchemaValidationError;
}>;

export const StartExaminationInput = {
  parse: (_raw: unknown): StartExaminationInputResult => ({
    isErr: () => false,
    _unsafeUnwrapErr: () => ({ kind: "SchemaValidationError", issues: [] }),
  }),
} as const;
