import { z } from "zod";

export const OwnerIdBrand = Symbol();

const OwnerIdSchema = z.string().uuid().brand<typeof OwnerIdBrand>();

export type OwnerId = z.infer<typeof OwnerIdSchema>;

export const OwnerId = {
  schema: OwnerIdSchema,
  safeParse: (raw: unknown) => OwnerIdSchema.safeParse(raw),
} as const;
