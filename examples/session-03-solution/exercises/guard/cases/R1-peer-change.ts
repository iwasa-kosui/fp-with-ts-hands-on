// このファイルを書き換えて、隣の人の仕組みをすり抜ける悪い変更を作ります
import { z } from "zod";

import { AppointmentId } from "../../../src/domain/appointment/index.js";
import { VeterinarianId } from "../../../src/domain/appointment/index.js";
import { schemaResult } from "../../../src/shared/schemaResult.js";

const schema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
}).readonly();

export type StartExaminationInput = z.infer<typeof schema>;

export const StartExaminationInput = {
  schema,
  parse: schemaResult(schema),
} as const;
