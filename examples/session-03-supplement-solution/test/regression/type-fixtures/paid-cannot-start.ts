// @ts-nocheck
import type { Paid } from "../../../src/domain/appointment/index.js";
import { startExamination } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

declare const paid: Paid;

// @ts-expect-error Paid から診察を開始できません。
startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt);
