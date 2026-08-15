// @ts-nocheck
import { toStatusLabel } from "../../src/domain/appointment/statusLabel.js";

const deferred = { kind: "Deferred" } as const;

// @ts-expect-error 6つ目の状態を足した場合は表示分岐を見直します。
toStatusLabel(deferred);
