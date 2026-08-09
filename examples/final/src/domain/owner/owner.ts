import { z } from "zod";

import type { EventContext } from "../aggregate/eventContext.js";
import { schemaResult } from "../shared/schemaResult.js";
import { OwnerEmail } from "./ownerEmail.js";
import {
  createOwnerCreated,
  createOwnerDeleted,
  createOwnerUpdated,
  type OwnerCreated,
  type OwnerDeleted,
  type OwnerUpdated,
} from "./ownerEvent.js";
import { OwnerId } from "./ownerId.js";
import { OwnerName } from "./ownerName.js";
import { OwnerPhone } from "./ownerPhone.js";

const OwnerSchema = z
  .object({
    ownerId: OwnerId.schema,
    name: OwnerName.schema,
    email: OwnerEmail.schema,
    phone: OwnerPhone.schema,
  })
  .readonly();

export type Owner = Readonly<z.infer<typeof OwnerSchema>>;
export type OwnerProfile = Readonly<Omit<Owner, "ownerId">>;

const create = (context: EventContext) => (owner: Owner): OwnerCreated =>
  createOwnerCreated(context, owner);

const update =
  (context: EventContext) =>
  (owner: Owner, profile: OwnerProfile): OwnerUpdated => {
    const aggregateState = {
      ownerId: owner.ownerId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    } as const satisfies Owner;

    return createOwnerUpdated(context, aggregateState);
  };

const remove = (context: EventContext) => (owner: Owner): OwnerDeleted =>
  createOwnerDeleted(context, owner.ownerId);

export const Owner = {
  schema: OwnerSchema,
  parse: schemaResult(OwnerSchema),
  create,
  update,
  delete: remove,
} as const;
