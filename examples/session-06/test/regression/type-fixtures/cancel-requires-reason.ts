// @ts-nocheck
import type { Scheduled } from "../../../src/domain/appointment/index.js";
import { cancel } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

declare const scheduled: Scheduled;

// @ts-expect-error キャンセル理由を省略できません。
cancel(scheduled, undefined, clinicFixture.scheduledAt);
