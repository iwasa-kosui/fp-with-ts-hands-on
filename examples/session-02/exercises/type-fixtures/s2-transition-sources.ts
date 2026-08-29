// @ts-nocheck
import type {
  CheckedIn,
  InExamination,
} from "../../src/domain/appointment/appointment.js";
import {
  checkIn,
  recordPayment,
} from "../../src/domain/appointment/transitions.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

declare const checkedIn: CheckedIn;
declare const examining: InExamination;

// @ts-expect-error CheckedIn を再度来院済みにできません。
checkIn(checkedIn, clinicFixture.checkedInAt);

// @ts-expect-error 診察結果を記録する前に会計できません。
recordPayment(examining, { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 }, clinicFixture.scheduledAt);
