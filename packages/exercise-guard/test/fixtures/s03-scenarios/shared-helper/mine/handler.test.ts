import { expect, it } from "vitest";

import { handle } from "../../../s03/exercises/guard/subjects/handler.js";
import { parseIds } from "./helper.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";

it("正しい ID は parse でき、ハンドラも 200 を返す", async () => {
  expect(parseIds(validAppointment, validVeterinarian).isOk()).toBe(true);
  const context = {
    req: { json: async () => ({ appointmentId: validAppointment, veterinarianId: validVeterinarian }) },
  };
  const response = await handle(context as never, () => undefined);
  expect(response.status).toBe(200);
});
