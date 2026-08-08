import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const installationTable = sqliteTable("installation", {
  installationKey: text("installation_key").primaryKey(),
});

export const usersTable = sqliteTable(
  "users",
  {
    userId: text("user_id").primaryKey(),
    role: text("role", {
      enum: ["Admin", "Receptionist", "Veterinarian"],
    }).notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    veterinarianId: text("veterinarian_id"),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessionsTable = sqliteTable(
  "sessions",
  {
    sessionId: text("session_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.userId, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)],
);

export const ownersTable = sqliteTable("owners", {
  ownerId: text("owner_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
});

export const petsTable = sqliteTable("pets", {
  petId: text("pet_id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => ownersTable.ownerId, { onDelete: "restrict" }),
  name: text("name").notNull(),
  species: text("species").notNull(),
});

export const appointmentsTable = sqliteTable("appointments", {
  appointmentId: text("appointment_id").primaryKey(),
  status: text("status", {
    enum: ["Scheduled", "CheckedIn", "InExamination", "Paid", "Canceled"],
  }).notNull(),
  ownerId: text("owner_id").notNull(),
  petId: text("pet_id").notNull(),
  state: text("state", { mode: "json" }).notNull(),
});

export const examResultsTable = sqliteTable("exam_results", {
  examId: text("exam_id").primaryKey(),
  petId: text("pet_id").notNull(),
  state: text("state", { mode: "json" }).notNull(),
});

export const domainEventsTable = sqliteTable(
  "domain_events",
  {
    eventId: text("event_id").primaryKey(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateName: text("aggregate_name").notNull(),
    aggregateState: text("aggregate_state", { mode: "json" }),
    eventName: text("event_name").notNull(),
    eventPayload: text("event_payload", { mode: "json" }).notNull(),
    occurredAt: text("occurred_at").notNull(),
    actorUserId: text("actor_user_id").notNull(),
  },
  (table) => [
    uniqueIndex("follow_up_requested_appointment_unique")
      .on(table.aggregateId)
      .where(sql`${table.eventName} = 'follow-up.requested'`),
  ],
);

export const sqliteSchema = {
  installationTable,
  usersTable,
  sessionsTable,
  ownersTable,
  petsTable,
  appointmentsTable,
  examResultsTable,
  domainEventsTable,
} as const;
