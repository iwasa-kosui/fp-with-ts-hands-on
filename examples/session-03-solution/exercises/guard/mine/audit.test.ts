import fc from "fast-check";
import { describe, it } from "vitest";

import { AppointmentId, VeterinarianId } from "../../../src/domain/appointment/index.js";
import { OwnerId } from "../../../src/domain/owner/index.js";
import { PetId } from "../../../src/domain/pet/index.js";
import { toAuditPayload } from "../subjects/audit.js";

const timestamp = fc
  .date({ min: new Date("2020-01-01T00:00:00.000Z"), max: new Date("2035-01-01T00:00:00.000Z"), noInvalidDate: true })
  .map((date) => date.toISOString());

const inExamination = fc.record({
  kind: fc.constant<"InExamination">("InExamination"),
  appointmentId: fc.uuid().map((id) => AppointmentId.parse(id)),
  petId: fc.uuid().map((id) => PetId.parse(id)),
  ownerId: fc.uuid().map((id) => OwnerId.parse(id)),
  scheduledAt: timestamp,
  reason: fc.string(),
  checkedInAt: timestamp,
  veterinarianId: fc.uuid().map((id) => VeterinarianId.parse(id)),
  examinationStartedAt: timestamp,
});

describe("toAuditPayload", () => {
  it("診察中の予約から作る監査記録の性質", () => {
    fc.assert(
      fc.property(inExamination, (appointment) => {
        const payload = toAuditPayload(appointment);
        // payload の項目名は Object.keys(payload) で取り出せます。「監査記録からの個人情報の除外」のページで見た、残してよい項目と比べます
        return true;
      }),
    );
  });
});
