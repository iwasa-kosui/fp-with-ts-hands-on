import type { Scheduled } from "../../../../src/domain/appointment/index.js";
import { startExamination } from "../../subjects/transitions.js";

declare const scheduled: Scheduled;

// @ts-expect-error
startExamination(scheduled, "44444444-4444-4444-8444-444444444444", "2026-08-30T06:20:00.000Z");
