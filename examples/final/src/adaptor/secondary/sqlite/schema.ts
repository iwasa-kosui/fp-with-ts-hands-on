import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    enum: [
      "Scheduled",
      "CheckedIn",
      "InExamination",
      "AwaitingPayment",
      "Paid",
      "Canceled",
    ],
  }).notNull(),
  ownerId: text("owner_id").notNull(),
  petId: text("pet_id").notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  serviceCode: text("service_code", {
    enum: [
      "GeneralConsultation",
      "FollowUpVisit",
      "Vaccination",
      "ExaminationOrProcedure",
    ],
  }).notNull(),
  bookingKind: text("booking_kind", { enum: ["Reserved", "WalkIn"] }).notNull(),
  assignedVeterinarianId: text("assigned_veterinarian_id"),
  receptionNote: text("reception_note"),
  settlementStatus: text("settlement_status", {
    enum: ["NoPayment", "DepositReceived", "Settled", "DepositRefunded"],
  }).notNull(),
  depositAmount: integer("deposit_amount"),
  version: integer("version").notNull(),
  state: text("state", { mode: "json" }).notNull(),
});

export const examResultsTable = sqliteTable("exam_results", {
  examId: text("exam_id").primaryKey(),
  petId: text("pet_id").notNull(),
  state: text("state", { mode: "json" }).notNull(),
});

export const followUpRequestClaimsTable = sqliteTable("follow_up_request_claims", {
  appointmentId: text("appointment_id").primaryKey(),
});

export const domainEventsTable = sqliteTable("domain_events", {
  eventId: text("event_id").primaryKey(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateName: text("aggregate_name").notNull(),
  eventName: text("event_name").notNull(),
  occurredAt: text("occurred_at").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  payloadSensitivity: text("payload_sensitivity", {
    enum: ["Regular", "Sensitive"],
  }).notNull(),
});

export const domainEventPayloadsTable = sqliteTable("domain_event_payloads", {
  eventId: text("event_id")
    .primaryKey()
    .references(() => domainEventsTable.eventId),
  aggregateState: text("aggregate_state", { mode: "json" }),
  eventPayload: text("event_payload", { mode: "json" }).notNull(),
});

export const domainEventSensitivePayloadsTable = sqliteTable(
  "domain_event_sensitive_payloads",
  {
    eventId: text("event_id")
      .primaryKey()
      .references(() => domainEventsTable.eventId),
    aggregateState: text("aggregate_state", { mode: "json" }),
    eventPayload: text("event_payload", { mode: "json" }).notNull(),
  },
);

export const sqliteSchema = {
  installationTable,
  usersTable,
  sessionsTable,
  ownersTable,
  petsTable,
  appointmentsTable,
  examResultsTable,
  followUpRequestClaimsTable,
  domainEventsTable,
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
} as const;
