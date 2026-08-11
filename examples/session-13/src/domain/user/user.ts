import type { UserId } from "./userId.js";

export type Receptionist = Readonly<{
  kind: "Receptionist";
  userId: UserId;
}>;

export type Veterinarian = Readonly<{
  kind: "Veterinarian";
  userId: UserId;
}>;

export type User = Receptionist | Veterinarian;
