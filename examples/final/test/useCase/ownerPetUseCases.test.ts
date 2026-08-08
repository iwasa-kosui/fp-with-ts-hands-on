import { okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventsTable,
  examResultsTable,
  ownersTable,
  petsTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createOwnerDeletedEventStore } from "../../src/adaptor/secondary/sqlite/store/ownerEventStore.js";
import { createPetDeletedEventStore } from "../../src/adaptor/secondary/sqlite/store/petEventStore.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import type { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import type { AppointmentByPetResolver } from "../../src/domain/appointment/appointmentResolver.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import {
  Owner,
  type Owner as OwnerState,
} from "../../src/domain/owner/owner.js";
import { OwnerEmail } from "../../src/domain/owner/ownerEmail.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { OwnerName } from "../../src/domain/owner/ownerName.js";
import { OwnerPhone } from "../../src/domain/owner/ownerPhone.js";
import type { OwnerResolver } from "../../src/domain/owner/ownerResolver.js";
import { Pet, type Pet as PetState } from "../../src/domain/pet/pet.js";
import { PetId } from "../../src/domain/pet/petId.js";
import type { PetResolver } from "../../src/domain/pet/petResolver.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserResolver } from "../../src/domain/user/userResolver.js";
import { CreateOwnerUseCase } from "../../src/useCase/createOwnerUseCase.js";
import { CreatePetUseCase } from "../../src/useCase/createPetUseCase.js";
import { DeleteOwnerUseCase } from "../../src/useCase/deleteOwnerUseCase.js";
import { DeletePetUseCase } from "../../src/useCase/deletePetUseCase.js";
import { GetOwnerUseCase } from "../../src/useCase/getOwnerUseCase.js";
import { GetPetUseCase } from "../../src/useCase/getPetUseCase.js";
import { ListOwnersUseCase } from "../../src/useCase/listOwnersUseCase.js";
import { ListPetsUseCase } from "../../src/useCase/listPetsUseCase.js";
import { UpdateOwnerUseCase } from "../../src/useCase/updateOwnerUseCase.js";
import { UpdatePetUseCase } from "../../src/useCase/updatePetUseCase.js";

const ids = {
  admin: UserId.schema.parse("81000000-0000-4000-8000-000000000001"),
  receptionist: UserId.schema.parse("81000000-0000-4000-8000-000000000002"),
  veterinarian: UserId.schema.parse("81000000-0000-4000-8000-000000000003"),
  owner: OwnerId.schema.parse("82000000-0000-4000-8000-000000000001"),
  newOwner: OwnerId.schema.parse("82000000-0000-4000-8000-000000000002"),
  pet: PetId.schema.parse("83000000-0000-4000-8000-000000000001"),
  newPet: PetId.schema.parse("83000000-0000-4000-8000-000000000002"),
  appointment: AppointmentId.schema.parse(
    "84000000-0000-4000-8000-000000000001",
  ),
} as const;
const now = Timestamp.schema.parse("2026-08-09T03:00:00.000Z");
const clock = { now: () => now } as const satisfies Clock;
const eventIdGenerator = (): EventIdGenerator => {
  let sequence = 1;
  return {
    generate: () =>
      EventId.schema.parse(
        `85000000-0000-4000-8000-${(sequence++).toString().padStart(12, "0")}`,
      ),
  };
};
const passwordHash = PasswordHash.schema.parse(
  `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
);
const user = (kind: User["kind"], userId: UserId): User => {
  const base = {
    userId,
    email: UserEmail.schema.parse(`${kind.toLowerCase()}@example.test`),
    name: UserName.schema.parse(kind),
    passwordHash,
  } as const;
  return kind === "Veterinarian"
    ? {
        kind,
        ...base,
        veterinarianId: VeterinarianId.schema.parse(
          "86000000-0000-4000-8000-000000000001",
        ),
      }
    : { kind, ...base };
};
const admin = user("Admin", ids.admin);
const receptionist = user("Receptionist", ids.receptionist);
const veterinarian = user("Veterinarian", ids.veterinarian);
const owner = {
  ownerId: ids.owner,
  name: OwnerName.schema.parse("Alice Owner"),
  email: OwnerEmail.schema.parse("alice@example.test"),
  phone: OwnerPhone.schema.parse("090-1111-2222"),
} as const satisfies OwnerState;
const changedProfile = {
  name: OwnerName.schema.parse("Alice Changed"),
  email: OwnerEmail.schema.parse("changed@example.test"),
  phone: OwnerPhone.schema.parse("090-3333-4444"),
} as const;
const pet = {
  petId: ids.pet,
  ownerId: ids.owner,
  name: "Mugi",
  species: "Cat",
} as const satisfies PetState;
const scheduled = {
  kind: "Scheduled",
  appointmentId: ids.appointment,
  ownerId: ids.owner,
  petId: ids.pet,
  scheduledAt: now,
  reason: "checkup",
} as const satisfies Appointment;

const userResolverFor = (actor: User): UserResolver => ({
  resolveById: (userId) => okAsync(userId === actor.userId ? actor : undefined),
  resolveByEmail: () => okAsync(undefined),
  resolveAll: () => okAsync([actor]),
});
const ownerResolverFor = (owners: readonly OwnerState[]): OwnerResolver => ({
  resolveById: (ownerId) =>
    okAsync(owners.find((candidate) => candidate.ownerId === ownerId)),
  resolveAll: () => okAsync(owners),
});
const petResolverFor = (pets: readonly PetState[]): PetResolver => ({
  resolveById: (petId) =>
    okAsync(pets.find((candidate) => candidate.petId === petId)),
  resolveByOwnerId: (ownerId) =>
    okAsync(pets.filter((candidate) => candidate.ownerId === ownerId)),
  resolveAll: () => okAsync(pets),
});
const appointmentResolverFor = (
  appointments: readonly Appointment[],
): AppointmentByPetResolver => ({
  resolveByPetId: (petId) =>
    okAsync(appointments.filter((candidate) => candidate.petId === petId)),
});
const storeEvents = <T>(events: T[]) => ({
  store: (...received: readonly T[]) => {
    events.push(...received);
    return okAsync(undefined);
  },
});

describe("owner and pet management use cases", () => {
  test("Receptionist creates and updates owners and pets through typed events", async () => {
    const ownerEvents: unknown[] = [];
    const petEvents: unknown[] = [];
    const common = {
      userResolver: userResolverFor(receptionist),
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const;

    const createdOwner = await CreateOwnerUseCase.create({
      ...common,
      ownerCreatedStore: storeEvents(ownerEvents),
      ownerIdGenerator: { generate: () => ids.newOwner },
    }).run({ actorUserId: ids.receptionist, ...changedProfile });
    const updatedOwner = await UpdateOwnerUseCase.create({
      ...common,
      ownerResolver: ownerResolverFor([owner]),
      ownerUpdatedStore: storeEvents(ownerEvents),
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      ...changedProfile,
    });
    const createdPet = await CreatePetUseCase.create({
      ...common,
      ownerResolver: ownerResolverFor([owner]),
      petCreatedStore: storeEvents(petEvents),
      petIdGenerator: { generate: () => ids.newPet },
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      name: "Sora",
      species: "Dog",
    });
    const updatedPet = await UpdatePetUseCase.create({
      ...common,
      petResolver: petResolverFor([pet]),
      petUpdatedStore: storeEvents(petEvents),
    }).run({
      actorUserId: ids.receptionist,
      petId: ids.pet,
      name: "Mugi II",
      species: "Cat",
    });

    expect(createdOwner._unsafeUnwrap().owner.ownerId).toBe(ids.newOwner);
    expect(updatedOwner._unsafeUnwrap().owner.name).toBe("Alice Changed");
    expect(createdPet._unsafeUnwrap().pet).toEqual({
      petId: ids.newPet,
      ownerId: ids.owner,
      name: "Sora",
      species: "Dog",
    });
    expect(updatedPet._unsafeUnwrap().pet.name).toBe("Mugi II");
    expect(ownerEvents).toMatchObject([
      { kind: "OwnerCreated", eventPayload: { ownerId: ids.newOwner } },
      { kind: "OwnerUpdated", eventPayload: { ownerId: ids.owner } },
    ]);
    expect(petEvents).toMatchObject([
      {
        kind: "PetCreated",
        eventPayload: { petId: ids.newPet, ownerId: ids.owner },
      },
      {
        kind: "PetUpdated",
        eventPayload: { petId: ids.pet, ownerId: ids.owner },
      },
    ]);
    expect(JSON.stringify([ownerEvents, petEvents])).not.toContain(
      "alice@example.test",
    );
  });

  test("Veterinarian is rejected before protected owner or pet data is resolved", async () => {
    const touched: string[] = [];
    const ownerResolver: OwnerResolver = {
      resolveById: () => {
        touched.push("owner");
        return okAsync(owner);
      },
      resolveAll: () => {
        touched.push("owners");
        return okAsync([owner]);
      },
    };
    const petResolver: PetResolver = {
      resolveById: () => {
        touched.push("pet");
        return okAsync(pet);
      },
      resolveByOwnerId: () => {
        touched.push("owner pets");
        return okAsync([pet]);
      },
      resolveAll: () => {
        touched.push("pets");
        return okAsync([pet]);
      },
    };
    const result = await GetOwnerUseCase.create({
      userResolver: userResolverFor(veterinarian),
      ownerResolver,
    }).run({ actorUserId: ids.veterinarian, ownerId: ids.owner });
    const petResult = await GetPetUseCase.create({
      userResolver: userResolverFor(veterinarian),
      petResolver,
    }).run({ actorUserId: ids.veterinarian, petId: ids.pet });

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "Unauthorized",
      actorUserId: ids.veterinarian,
    });
    expect(petResult._unsafeUnwrapErr().kind).toBe("Unauthorized");
    expect(touched).toEqual([]);
  });

  test("rejects missing owner and deletion-ineligible aggregates before emitting events", async () => {
    const ownerEvents: unknown[] = [];
    const petEvents: unknown[] = [];
    const common = {
      userResolver: userResolverFor(admin),
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const;

    const missingOwner = await CreatePetUseCase.create({
      ...common,
      ownerResolver: ownerResolverFor([]),
      petCreatedStore: storeEvents(petEvents),
      petIdGenerator: { generate: () => ids.newPet },
    }).run({
      actorUserId: ids.admin,
      ownerId: ids.owner,
      name: "Sora",
      species: "Dog",
    });
    const ownerWithPets = await DeleteOwnerUseCase.create({
      ...common,
      ownerResolver: ownerResolverFor([owner]),
      petResolver: petResolverFor([pet]),
      ownerDeletedStore: storeEvents(ownerEvents),
    }).run({ actorUserId: ids.admin, ownerId: ids.owner });
    const petWithActiveAppointment = await DeletePetUseCase.create({
      ...common,
      petResolver: petResolverFor([pet]),
      appointmentResolver: appointmentResolverFor([scheduled]),
      petDeletedStore: storeEvents(petEvents),
    }).run({ actorUserId: ids.admin, petId: ids.pet });

    expect(missingOwner._unsafeUnwrapErr()).toEqual({
      kind: "OwnerNotFound",
      ownerId: ids.owner,
    });
    expect(ownerWithPets._unsafeUnwrapErr()).toEqual({
      kind: "OwnerHasPets",
      ownerId: ids.owner,
    });
    expect(petWithActiveAppointment._unsafeUnwrapErr()).toEqual({
      kind: "PetHasActiveAppointment",
      petId: ids.pet,
    });
    expect(ownerEvents).toEqual([]);
    expect(petEvents).toEqual([]);
  });

  test("allows pet deletion when every appointment is terminal", async () => {
    const events: unknown[] = [];
    const paid = {
      ...scheduled,
      kind: "Paid",
      checkedInAt: now,
      veterinarianId: VeterinarianId.schema.parse(
        "86000000-0000-4000-8000-000000000001",
      ),
      examinationStartedAt: now,
      diagnosis: "healthy",
      treatment: "none",
      amount: PaymentAmount.schema.parse(1000),
      paidAt: now,
    } as const satisfies Appointment;
    const canceled = {
      ...scheduled,
      appointmentId: AppointmentId.schema.parse(
        "84000000-0000-4000-8000-000000000002",
      ),
      kind: "Canceled",
      canceledAt: now,
    } as const satisfies Appointment;

    const result = await DeletePetUseCase.create({
      userResolver: userResolverFor(receptionist),
      petResolver: petResolverFor([pet]),
      appointmentResolver: appointmentResolverFor([paid, canceled]),
      petDeletedStore: storeEvents(events),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.receptionist, petId: ids.pet });

    expect(result._unsafeUnwrap()).toEqual({ petId: ids.pet });
    expect(events).toMatchObject([
      {
        kind: "PetDeleted",
        aggregateState: undefined,
        eventPayload: { petId: ids.pet },
      },
    ]);
  });

  test("owner queries expose only explicitly selected operational PII", async () => {
    const owners = await ListOwnersUseCase.create({
      userResolver: userResolverFor(receptionist),
      ownerResolver: ownerResolverFor([owner]),
    }).run({ actorUserId: ids.receptionist });
    const ownerDetail = await GetOwnerUseCase.create({
      userResolver: userResolverFor(admin),
      ownerResolver: ownerResolverFor([owner]),
    }).run({ actorUserId: ids.admin, ownerId: ids.owner });
    const pets = await ListPetsUseCase.create({
      userResolver: userResolverFor(admin),
      petResolver: petResolverFor([pet]),
    }).run({ actorUserId: ids.admin });

    expect(owners._unsafeUnwrap()).toEqual({
      owners: [
        {
          ownerId: ids.owner,
          name: "Alice Owner",
          email: "alice@example.test",
          phone: "090-1111-2222",
        },
      ],
    });
    expect(ownerDetail._unsafeUnwrap()).toEqual({
      owner: owners._unsafeUnwrap().owners[0],
    });
    expect(pets._unsafeUnwrap()).toEqual({ pets: [pet] });
    expect(Object.keys(ownerDetail._unsafeUnwrap().owner).sort()).toEqual([
      "email",
      "name",
      "ownerId",
      "phone",
    ]);
  });

  test("SQLite deletion stores recheck stale eligibility atomically and preserve history", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.insert(ownersTable)
      .values({
        ownerId: ids.owner,
        name: owner.name.unwrap(),
        email: owner.email.unwrap(),
        phone: owner.phone.unwrap(),
      })
      .run();
    db.insert(petsTable).values(pet).run();
    db.insert(appointmentsTable)
      .values({
        appointmentId: scheduled.appointmentId,
        ownerId: scheduled.ownerId,
        petId: scheduled.petId,
        status: scheduled.kind,
        state: scheduled,
      })
      .run();

    const stalePetDelete = await DeletePetUseCase.create({
      userResolver: userResolverFor(admin),
      petResolver: petResolverFor([pet]),
      appointmentResolver: appointmentResolverFor([]),
      petDeletedStore: createPetDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.admin, petId: ids.pet });
    const staleOwnerDelete = await DeleteOwnerUseCase.create({
      userResolver: userResolverFor(admin),
      ownerResolver: ownerResolverFor([owner]),
      petResolver: petResolverFor([]),
      ownerDeletedStore: createOwnerDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.admin, ownerId: ids.owner });

    expect(stalePetDelete._unsafeUnwrapErr()).toEqual({
      kind: "PetHasActiveAppointment",
      petId: ids.pet,
    });
    expect(staleOwnerDelete._unsafeUnwrapErr()).toEqual({
      kind: "OwnerHasPets",
      ownerId: ids.owner,
    });
    expect(db.select().from(petsTable).all()).toHaveLength(1);
    expect(db.select().from(ownersTable).all()).toHaveLength(1);
    expect(db.select().from(domainEventsTable).all()).toEqual([]);

    db.update(appointmentsTable)
      .set({
        status: "Canceled",
        state: { ...scheduled, kind: "Canceled", canceledAt: now },
      })
      .run();
    db.insert(examResultsTable)
      .values({
        examId: ExamId.schema.parse("87000000-0000-4000-8000-000000000001"),
        petId: ids.pet,
        state: {
          examId: "87000000-0000-4000-8000-000000000001",
          petId: ids.pet,
          collectedAt: now,
          items: ["blood test"],
          needsFollowUp: false,
        },
      })
      .run();
    const deletedPet = await DeletePetUseCase.create({
      userResolver: userResolverFor(admin),
      petResolver: petResolverFor([pet]),
      appointmentResolver: appointmentResolverFor([]),
      petDeletedStore: createPetDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.admin, petId: ids.pet });
    expect(deletedPet.isOk()).toBe(true);
    expect(db.select().from(petsTable).all()).toEqual([]);
    expect(db.select().from(appointmentsTable).all()).toHaveLength(1);
    expect(db.select().from(examResultsTable).all()).toHaveLength(1);
    expect(db.select().from(domainEventsTable).all()).toHaveLength(1);
  });
});
