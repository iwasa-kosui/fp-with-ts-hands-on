export type ActionAvailability =
  | Readonly<{
      kind: "Available";
      href: string;
      method: "get" | "post";
      data?: Readonly<Record<string, string>>;
    }>
  | Readonly<{
      kind: "NotImplemented";
      href: string;
      method: "get" | "post";
      data?: Readonly<Record<string, string>>;
    }>
  | Readonly<{ kind: "Hidden" }>;

export type AppointmentActions = Readonly<{
  checkIn: ActionAvailability;
  startExamination: ActionAvailability;
  recordExamResult: ActionAvailability;
  recordPayment: ActionAvailability;
  cancel: ActionAvailability;
  requestFollowUp: ActionAvailability;
}>;

export type IncidentScenario = Readonly<{
  title: string;
  description: string;
  action: Exclude<ActionAvailability, { kind: "Hidden" }>;
}>;

export type DatabaseInspection = Readonly<{
  appointmentJson: string;
  auditLogJson: string;
  warnings: readonly string[];
}>;

export type IncidentLab = Readonly<{
  scenarios: readonly IncidentScenario[];
  inspection: DatabaseInspection;
}>;

export type ClinicAppointmentView = Readonly<{
  appointmentId: string;
  kind: string;
  ownerName: string;
  petName: string;
  scheduledAt: string;
  statusLabel: string;
}>;

export type Notice =
  | Readonly<{ kind: "FeatureNotImplemented" }>
  | Readonly<{ kind: "InvalidAppointmentState" }>
  | Readonly<{ kind: "AppointmentNotFound" }>
  | Readonly<{ kind: "AppointmentConflict" }>
  | null;

export type ClinicPageProps = Readonly<{
  actions: AppointmentActions;
  appointment: ClinicAppointmentView;
  incidentLab?: IncidentLab;
  learningFocus: string;
  notice: Notice;
  sessionLabel: string;
}>;

export type ClinicUserView = Readonly<{
  role: "Admin" | "Receptionist" | "Veterinarian";
}>;
