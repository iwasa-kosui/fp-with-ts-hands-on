// @ts-nocheck
import type { Paid } from "../../../src/domain/appointment/appointment.js";
import { startExamination } from "../../../src/domain/appointment/transitions.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

declare const paid: Paid;

// @ts-expect-error Paid から診察を開始できません。
startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt);
