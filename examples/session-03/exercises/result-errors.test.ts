import { expect, it } from "vitest";

const rawInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  startedAt: "2026-08-30T06:30:00.000Z",
};

it("成功した診察開始だけを domain event に残す", async () => {
  const [
    { startExaminationUseCase },
    { createInMemoryAppointmentRepository },
    { createInMemoryDomainEventStore },
  ] = await Promise.all([
    import("../src/application/start-examination.js"),
    import("../src/infrastructure/in-memory-appointment-repository.js"),
    import("../src/infrastructure/in-memory-domain-event-store.js"),
  ]);
  const repository = createInMemoryAppointmentRepository([]);
  const eventStore = createInMemoryDomainEventStore();

  const result = startExaminationUseCase(repository, eventStore)(rawInput);

  expect(result.isOk()).toBe(true);
  expect(eventStore.all()).toHaveLength(1);
});
