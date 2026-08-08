import { err, ok, type Result } from "neverthrow";

import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { User } from "../domain/user/user.js";
import type { UnauthorizedError } from "./errors.js";

export const ensureCanStartExamination = (
  veterinarianId: VeterinarianId,
) =>
  (user: User): Result<User, UnauthorizedError> =>
    user.kind === "Admin" ||
    (user.kind === "Veterinarian" && user.veterinarianId === veterinarianId)
      ? ok(user)
      : err({ kind: "Unauthorized", actorUserId: user.userId });
