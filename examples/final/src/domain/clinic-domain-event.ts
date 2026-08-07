import type { ExaminationStarted } from "./examination-started.js";
import type { FollowUpRequested } from "./follow-up-requested.js";

export type ClinicDomainEvent = ExaminationStarted | FollowUpRequested;
