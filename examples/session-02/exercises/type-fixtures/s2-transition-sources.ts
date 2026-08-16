// @ts-nocheck
import type { CheckedIn } from "../../src/domain/appointment/appointment.js";
import { checkIn } from "../../src/domain/appointment/transitions.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

declare const checkedIn: CheckedIn;

// @ts-expect-error CheckedIn を再度来院済みにできません。
checkIn(checkedIn, clinicFixture.checkedInAt);
