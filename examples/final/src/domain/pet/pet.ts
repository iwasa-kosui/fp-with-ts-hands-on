import { z } from "zod";

import type { EventContext } from "../aggregate/eventContext.js";
import { OwnerId } from "../owner/ownerId.js";
import { schemaResult } from "../shared/schemaResult.js";
import { PetEvent, type PetCreated, type PetDeleted, type PetUpdated } from "./petEvent.js";
import { PetId } from "./petId.js";

const PetSchema = z
  .object({
    petId: PetId.schema,
    ownerId: OwnerId.schema,
    name: z.string().trim().min(1).max(100),
    species: z.string().trim().min(1).max(100),
  })
  .readonly();

export type Pet = Readonly<z.infer<typeof PetSchema>>;
export type PetProfile = Readonly<Pick<Pet, "name" | "species">>;

const create = (context: EventContext) => (pet: Pet): PetCreated =>
  PetEvent.create(context, pet.petId, pet.ownerId, pet, "PetCreated", "pet.created");

const update =
  (context: EventContext) =>
  (pet: Pet, profile: PetProfile): PetUpdated => {
    const aggregateState = { ...pet, ...profile } as const satisfies Pet;

    return PetEvent.create(
      context,
      pet.petId,
      pet.ownerId,
      aggregateState,
      "PetUpdated",
      "pet.updated",
    );
  };

const remove = (context: EventContext) => (pet: Pet): PetDeleted =>
  PetEvent.create(context, pet.petId, pet.ownerId, undefined, "PetDeleted", "pet.deleted");

export const Pet = {
  schema: PetSchema,
  parse: schemaResult(PetSchema),
  create,
  update,
  delete: remove,
} as const;
