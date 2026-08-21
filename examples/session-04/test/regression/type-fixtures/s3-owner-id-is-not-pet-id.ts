// @ts-nocheck
import { OwnerId } from "../../../src/domain/ids/ownerId.js";
import type { PetId } from "../../../src/domain/ids/petId.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const acceptPetId = (_petId: PetId): void => undefined;
const ownerId = OwnerId.parse(clinicFixture.ownerId);

// @ts-expect-error OwnerId を PetId として使えません。
acceptPetId(ownerId);