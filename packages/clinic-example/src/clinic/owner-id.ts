import { z } from "zod";

const OwnerIdBrand = Symbol("OwnerId");
const OwnerIdSchema = z.string().regex(/^owner_[0-9]{3}$/).brand<typeof OwnerIdBrand>();
export type OwnerId = z.infer<typeof OwnerIdSchema>;

export const OwnerId: Readonly<{
  schema: typeof OwnerIdSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, OwnerId>;
}> = {
  schema: OwnerIdSchema,
  safeParse: (raw) => OwnerIdSchema.safeParse(raw),
};
