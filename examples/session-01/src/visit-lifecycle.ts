export type VisitLifecycle = Readonly<{
  states: readonly ["Scheduled", "CheckedIn", "InExamination", "Paid", "Canceled"];
  terminalStates: readonly ["Paid", "Canceled"];
  cancellationRequires: readonly ["reason", "canceledAt"];
}>;

export const visitLifecycle = {
  states: ["Scheduled", "CheckedIn", "InExamination", "Paid", "Canceled"],
  terminalStates: ["Paid", "Canceled"],
  cancellationRequires: ["reason", "canceledAt"],
} as const satisfies VisitLifecycle;
