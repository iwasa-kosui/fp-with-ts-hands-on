import { StartExaminationInput } from "../../subjects/input.js";

declare const raw: unknown;

// @ts-expect-error
const n: number = StartExaminationInput.parse(raw)._unsafeUnwrap();

export { n };
