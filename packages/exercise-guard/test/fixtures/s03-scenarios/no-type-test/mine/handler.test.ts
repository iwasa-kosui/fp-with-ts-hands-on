import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { handle } from "../../../s03/exercises/guard/subjects/handler.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notUuid = fc.string().filter((value) => !uuidLike.test(value));

const call = async (body: unknown) => {
  const seen: unknown[] = [];
  const context = { req: { json: async () => body } };
  const response = await handle(context as never, (input) => {
    seen.push(input);
  });
  return { response, seen };
};

describe("handle", () => {
  it("不正な ID の本文はユースケースに渡さず 400 を返す", async () => {
    await fc.assert(
      fc.asyncProperty(notUuid, async (id) => {
        const { response, seen } = await call({
          appointmentId: id,
          veterinarianId: validVeterinarian,
        });
        return seen.length === 0 && response.status === 400;
      }),
      { numRuns: 30 },
    );
  });

  it("正しい本文はユースケースに渡す", async () => {
    const { response, seen } = await call({
      appointmentId: validAppointment,
      veterinarianId: validVeterinarian,
    });
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
  });
});
