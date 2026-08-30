import Database from "better-sqlite3";

export type AuditLogObservation = Readonly<{
  appointmentId: string;
  eventId: string;
  eventName: string;
  occurredAt: string;
  payload: unknown;
}>;

export type AppointmentObservation = Readonly<{
  state: unknown;
  auditLogs: readonly AuditLogObservation[];
}>;

const parseJson = (value: string, column: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`Could not parse SQLite ${column} JSON`, { cause: error });
  }
};

export const observeAppointment = (
  databasePath: string,
  appointmentId: string,
): AppointmentObservation => {
  const database = new Database(databasePath, { readonly: true });

  try {
    const appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(appointmentId) as Readonly<{ state: string }> | undefined;
    if (appointment === undefined) {
      throw new Error(`Appointment was not persisted: ${appointmentId}`);
    }

    const auditLogs = database
      .prepare(
        "SELECT appointment_id AS appointmentId, event_id AS eventId, event_name AS eventName, occurred_at AS occurredAt, payload FROM audit_logs ORDER BY rowid",
      )
      .all() as ReadonlyArray<Readonly<{
        appointmentId: string;
        eventId: string;
        eventName: string;
        occurredAt: string;
        payload: string;
      }>>;

    return {
      state: parseJson(appointment.state, "appointments.state"),
      auditLogs: auditLogs.map((auditLog) => ({
        appointmentId: auditLog.appointmentId,
        eventId: auditLog.eventId,
        eventName: auditLog.eventName,
        occurredAt: auditLog.occurredAt,
        payload: parseJson(auditLog.payload, "audit_logs.payload"),
      })),
    };
  } finally {
    database.close();
  }
};
