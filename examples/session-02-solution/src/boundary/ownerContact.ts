import { ok, type Result } from "../shared/schemaResult.js";

export type OwnerContact = Readonly<{
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}>;

export const OwnerContact = {
  parse: (raw: any): Result<OwnerContact> =>
    ok({
      ownerName: raw.ownerName,
      ownerEmail: raw.ownerEmail,
      ownerPhone: raw.ownerPhone,
    }),
} as const;
