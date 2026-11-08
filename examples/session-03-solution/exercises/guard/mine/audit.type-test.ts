import { toAuditPayload } from "../subjects/audit.js";

type Payload = ReturnType<typeof toAuditPayload>;

// ここに確かめる型を書きます
export type { Payload };
