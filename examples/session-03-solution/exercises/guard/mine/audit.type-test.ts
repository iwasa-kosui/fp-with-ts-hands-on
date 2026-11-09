import { toAuditPayload } from "../subjects/audit.js";

type Payload = ReturnType<typeof toAuditPayload>;

// ここに検証する型を実装します
export type { Payload };
