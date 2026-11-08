import { toAuditPayload } from "../../subjects/audit.js";

type Payload = ReturnType<typeof toAuditPayload>;
type Extra = Exclude<keyof Payload, "appointmentId" | "veterinarianId" | "examinationStartedAt">;

// @ts-expect-error
const extra: Extra = "ownerContact";

export { extra };
