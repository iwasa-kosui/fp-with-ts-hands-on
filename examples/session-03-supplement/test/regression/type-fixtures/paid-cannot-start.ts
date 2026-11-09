// @ts-nocheck
import type { Paid } from "../../../src/domain/appointment/index.js";
import { startExamination } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

declare const paid: Paid;

// @ts-expect-error Paid は startExamination の引数の型に代入できません。
startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt);
