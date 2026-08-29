import { z } from "zod";

import type { EventContext } from "../aggregate/eventContext.js";
import { OwnerId } from "../owner/index.js";
import { schemaResult } from "../shared/schemaResult.js";
import {
  createPetCreated,
  createPetDeleted,
  createPetUpdated,
  type PetCreated,
  type PetDeleted,
  type PetUpdated,
} from "./petEvent.js";
import { PetId } from "./petId.js";
import { PetName } from "./petName.js";
import { PetSpecies } from "./petSpecies.js";

const PetSchema = z
  .object({
    petId: PetId.schema,
    ownerId: OwnerId.schema,
    name: PetName.schema,
    species: PetSpecies.schema,
  })
  .readonly();

export type Pet = Readonly<z.infer<typeof PetSchema>>;
export type PetProfile = Readonly<Pick<Pet, "name" | "species">>;

const create = (context: EventContext) => (pet: Pet): PetCreated =>
  createPetCreated(context, pet);

const update =
  (context: EventContext) =>
  (pet: Pet, profile: PetProfile): PetUpdated => {
    const aggregateState = { ...pet, ...profile } as const satisfies Pet;

    return createPetUpdated(context, aggregateState);
  };

const remove = (context: EventContext) => (pet: Pet): PetDeleted =>
  createPetDeleted(context, pet);

export const Pet = {
  schema: PetSchema,
  parse: schemaResult(PetSchema),
  create,
  update,
  delete: remove,
} as const;
