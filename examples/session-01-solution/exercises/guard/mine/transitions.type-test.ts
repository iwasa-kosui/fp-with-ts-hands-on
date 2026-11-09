import type { Scheduled } from "../../../src/domain/appointment/index.js";
import { startExamination } from "../subjects/transitions.js";

declare const scheduled: Scheduled;

// ここに検証する呼び出しを実装します
export { scheduled, startExamination };
