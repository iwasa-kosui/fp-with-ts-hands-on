import type {
  InstallationStatus,
  InstallationStatusQuery,
} from "../../../domain/installation/installationStatusQuery.js";
import { assertNever } from "./middleware/useCaseResponse.js";

export const resolveInstallationStatus = (
  query: InstallationStatusQuery,
): Promise<InstallationStatus> =>
  query.get().match(
    (status) => status,
    (error) => assertNever(error),
  );
