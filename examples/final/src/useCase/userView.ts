import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import { assertNever } from "../domain/shared/assertNever.js";
import type { User } from "../domain/user/user.js";
import type { UserEmail } from "../domain/user/userEmail.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserName } from "../domain/user/userName.js";

type UserViewBase = Readonly<{
  userId: UserId;
  email: UserEmail;
  name: UserName;
}>;

type AdminView = UserViewBase & Readonly<{ kind: "Admin" }>;
type ReceptionistView = UserViewBase & Readonly<{ kind: "Receptionist" }>;
type VeterinarianView = UserViewBase & Readonly<{
  kind: "Veterinarian";
  veterinarianId: VeterinarianId;
}>;

export type UserView = AdminView | ReceptionistView | VeterinarianView;

export const toUserView = (user: User): UserView => {
  const base = {
    userId: user.userId,
    email: user.email,
    name: user.name,
  } as const;

  switch (user.kind) {
    case "Admin":
      return { ...base, kind: user.kind };
    case "Receptionist":
      return { ...base, kind: user.kind };
    case "Veterinarian":
      return {
        ...base,
        kind: user.kind,
        veterinarianId: user.veterinarianId,
      };
    default:
      return assertNever(user);
  }
};
