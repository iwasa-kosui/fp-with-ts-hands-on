export const clinicFixture = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  ownerId: "33333333-3333-4333-8333-333333333333",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  examId: "77777777-7777-4777-8777-777777777777",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  checkedInAt: "2026-08-30T06:20:00.000Z",
  ownerContact: {
    ownerName: "Owner A",
    ownerEmail: "owner@example.test",
    ownerPhone: "090-0000-0000",
  },
} as const;
