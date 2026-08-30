export class AppointmentPersistenceError extends Error {
  readonly kind = "AppointmentPersistenceError";

  constructor(
    readonly operation: "resolve" | "save-state" | "append-audit",
    readonly cause: unknown,
  ) {
    super(`Appointment persistence failed: ${operation}`, { cause });
  }
}
