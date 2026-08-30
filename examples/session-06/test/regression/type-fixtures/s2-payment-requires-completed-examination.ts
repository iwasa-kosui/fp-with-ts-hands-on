// @ts-nocheck
import type { InExamination } from "../../../src/domain/appointment/index.js";
import {
  completeExamination,
  recordPayment,
} from "../../../src/domain/appointment/index.js";
import { ExamId } from "../../../src/domain/examResult/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

declare const examining: InExamination;

const awaitingPayment = completeExamination(
  examining,
  { examId: ExamId.parse(clinicFixture.examId) },
  clinicFixture.scheduledAt,
);
recordPayment(
  awaitingPayment,
  { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
  clinicFixture.scheduledAt,
);

// @ts-expect-error InExamination から直接会計できません。
recordPayment(examining, { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 }, clinicFixture.scheduledAt);
