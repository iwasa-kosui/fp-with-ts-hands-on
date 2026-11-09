import { toStatusLabel } from "../../subjects/statusLabel.js";

// @ts-expect-error
toStatusLabel({ kind: "NoSuchState" });
