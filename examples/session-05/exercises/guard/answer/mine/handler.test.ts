import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { handle } from "../../subjects/handler.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notUuid = fc.string().filter((value) => !uuidLike.test(value));

const call = async (body: unknown) => {
  const seen: unknown[] = [];
  const context = { req: { json: async () => body } };
  await handle(context as never, (input) => {
    seen.push(input);
  }).catch(() => undefined);
  return seen;
};

describe("handle", () => {
  it("不正な ID の本文では、診察開始の処理を呼ばない", async () => {
    await fc.assert(
      fc.asyncProperty(notUuid, async (id) => {
        const seen = await call({
          appointmentId: id,
          veterinarianId: validVeterinarian,
        });
        return seen.length === 0;
      }),
      { numRuns: 30 },
    );
  });

  it("正しい本文では、診察開始の処理を呼ぶ", async () => {
    const seen = await call({
      appointmentId: validAppointment,
      veterinarianId: validVeterinarian,
    });
    expect(seen).toHaveLength(1);
  });
});
