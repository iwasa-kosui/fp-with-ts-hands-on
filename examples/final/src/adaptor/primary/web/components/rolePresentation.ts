import type { User } from "../../../../domain/user/user.js";

import { assertNever } from "../middleware/useCaseResponse.js";

export const rolePresentation = (role: User["kind"]): string => {
  switch (role) {
    case "Admin":
      return "管理者";
    case "Receptionist":
      return "受付";
    case "Veterinarian":
      return "獣医師";
    default:
      return assertNever(role);
  }
};
