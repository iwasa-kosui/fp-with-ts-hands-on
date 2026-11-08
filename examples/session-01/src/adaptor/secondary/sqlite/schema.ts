import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appointmentsTable = sqliteTable("appointments", {
  appointmentId: text("appointment_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  petId: text("pet_id").notNull(),
  status: text("status").notNull(),
  state: text("state", { mode: "json" }).notNull(),
  ownerContact: text("owner_contact", { mode: "json" }).notNull(),
});

export const auditLogsTable = sqliteTable("audit_logs", {
  eventId: text("event_id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  eventName: text("event_name").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  occurredAt: text("occurred_at").notNull(),
});

export const sqliteSchema = { appointmentsTable, auditLogsTable } as const;
