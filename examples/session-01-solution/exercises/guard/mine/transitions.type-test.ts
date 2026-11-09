import type { Scheduled } from "../../../src/domain/appointment/index.js";
import { startExamination } from "../subjects/transitions.js";

declare const scheduled: Scheduled;

// ここに確かめる呼び出しを書きます
export { scheduled, startExamination };
