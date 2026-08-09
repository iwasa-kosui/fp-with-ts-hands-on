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
import {
  createOwnerDeletedEventStore,
  createOwnerEventStore,
} from "../../src/adaptor/secondary/sqlite/store/ownerEventStore.js";
import {
  createPetDeletedEventStore,
  createPetEventStore,
} from "../../src/adaptor/secondary/sqlite/store/petEventStore.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import type { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import type { AppointmentByPetIdResolver } from "../../src/domain/appointment/appointmentResolver.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { Settlement } from "../../src/domain/appointment/settlementState.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import {
  Owner,
  type Owner as OwnerState,
} from "../../src/domain/owner/owner.js";
import { OwnerEmail } from "../../src/domain/owner/ownerEmail.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { OwnerName } from "../../src/domain/owner/ownerName.js";
import { OwnerPhone } from "../../src/domain/owner/ownerPhone.js";
import type {
  OwnerByIdResolver,
  OwnerListResolver,
} from "../../src/domain/owner/ownerResolver.js";
import { Pet, type Pet as PetState } from "../../src/domain/pet/pet.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { PetName } from "../../src/domain/pet/petName.js";
import { PetSpecies } from "../../src/domain/pet/petSpecies.js";
import type {
  PetByIdResolver,
  PetByOwnerIdResolver,
  PetListResolver,
} from "../../src/domain/pet/petResolver.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserByIdResolver } from "../../src/domain/user/userResolver.js";
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
  otherOwner: OwnerId.schema.parse("82000000-0000-4000-8000-000000000003"),
  pet: PetId.schema.parse("83000000-0000-4000-8000-000000000001"),
  newPet: PetId.schema.parse("83000000-0000-4000-8000-000000000002"),
  otherPet: PetId.schema.parse("83000000-0000-4000-8000-000000000003"),
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
const pet = Pet.parse({
  petId: ids.pet,
  ownerId: ids.owner,
  name: "Mugi",
  species: "Cat",
})._unsafeUnwrap();
const scheduled = {
  kind: "Scheduled",
  appointmentId: ids.appointment,
  ownerId: ids.owner,
  petId: ids.pet,
  scheduledAt: now,
  durationMinutes: 30,
  serviceCode: "GeneralConsultation",
  bookingKind: "Reserved",
  assignedVeterinarianId: null,
  visitReason: AppointmentReason.schema.parse("checkup"),
  receptionNote: null,
  settlement: { kind: "NoPayment" },
  version: AppointmentVersion.schema.parse(1),
} as const satisfies Appointment;

const appointmentRow = (state: Appointment) => ({
  appointmentId: state.appointmentId,
  ownerId: state.ownerId,
  petId: state.petId,
  status: state.kind,
  scheduledAt: state.scheduledAt,
  durationMinutes: state.durationMinutes,
  serviceCode: state.serviceCode,
  bookingKind: state.bookingKind,
  assignedVeterinarianId: state.assignedVeterinarianId,
  receptionNote: state.receptionNote?.unwrap() ?? null,
  settlementStatus: state.settlement.kind,
  depositAmount: state.settlement.kind === "NoPayment"
    ? null
    : state.settlement.depositAmount,
  version: state.version,
  state,
});
const otherOwner = {
  ...owner,
  ownerId: ids.otherOwner,
} as const satisfies OwnerState;
const otherPet = {
  ...pet,
  petId: ids.otherPet,
  ownerId: ids.otherOwner,
} as const satisfies PetState;
const petRow = (state: PetState) => ({
  petId: state.petId,
  ownerId: state.ownerId,
  name: state.name.unwrap(),
  species: state.species,
});
const context = (sequence: number) => ({
  eventId: EventId.schema.parse(
    `88000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
  ),
  occurredAt: now,
  actorUserId: ids.admin,
});

const userResolverFor = (actor: User): UserByIdResolver => ({
  resolveById: (userId) => okAsync(userId === actor.userId ? actor : undefined),
});
type OwnerResolverFixture = OwnerByIdResolver & OwnerListResolver;
type PetResolverFixture = PetByIdResolver & PetByOwnerIdResolver & PetListResolver;

const ownerResolverFor = (owners: readonly OwnerState[]): OwnerResolverFixture => ({
  resolveById: (ownerId) =>
    okAsync(owners.find((candidate) => candidate.ownerId === ownerId)),
  resolveAll: () => okAsync(owners),
});
const petResolverFor = (pets: readonly PetState[]): PetResolverFixture => ({
  resolveById: (petId) =>
    okAsync(pets.find((candidate) => candidate.petId === petId)),
  resolveByOwnerId: (ownerId) =>
    okAsync(pets.filter((candidate) => candidate.ownerId === ownerId)),
  resolveAll: () => okAsync(pets),
});
const appointmentResolverFor = (
  appointments: readonly Appointment[],
): AppointmentByPetIdResolver => ({
  resolveByPetId: (petId) =>
    okAsync(appointments.filter((candidate) => candidate.petId === petId)),
});
const storeEvents = <T>(events: T[]) => ({
  store: (...received: readonly T[]) => {
    events.push(...received);
    return okAsync(undefined);
  },
});

const authorizationSpies = () => {
  const forbiddenTouches: string[] = [];
  let actorLookups = 0;
  const touch = (name: string) => forbiddenTouches.push(name);
  return {
    userResolver: {
      resolveById: () => {
        actorLookups += 1;
        return okAsync(veterinarian);
      },
    } as const satisfies UserByIdResolver,
    ownerResolver: {
      resolveById: () => {
        touch("ownerResolver.resolveById");
        return okAsync(owner);
      },
      resolveAll: () => {
        touch("ownerResolver.resolveAll");
        return okAsync([owner]);
      },
    } as const satisfies OwnerResolverFixture,
    petResolver: {
      resolveById: () => {
        touch("petResolver.resolveById");
        return okAsync(pet);
      },
      resolveByOwnerId: () => {
        touch("petResolver.resolveByOwnerId");
        return okAsync([pet]);
      },
      resolveAll: () => {
        touch("petResolver.resolveAll");
        return okAsync([pet]);
      },
    } as const satisfies PetResolverFixture,
    appointmentResolver: {
      resolveByPetId: () => {
        touch("appointmentResolver.resolveByPetId");
        return okAsync([scheduled]);
      },
    } as const satisfies AppointmentByPetIdResolver,
    store: {
      store: () => {
        touch("store.store");
        return okAsync(undefined);
      },
    },
    clock: {
      now: () => {
        touch("clock.now");
        return now;
      },
    } as const satisfies Clock,
    eventIdGenerator: {
      generate: () => {
        touch("eventIdGenerator.generate");
        return context(91).eventId;
      },
    } as const satisfies EventIdGenerator,
    ownerIdGenerator: {
      generate: () => {
        touch("ownerIdGenerator.generate");
        return ids.newOwner;
      },
    },
    petIdGenerator: {
      generate: () => {
        touch("petIdGenerator.generate");
        return ids.newPet;
      },
    },
    forbiddenTouches,
    actorLookups: () => actorLookups,
  } as const;
};

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
      name: PetName.schema.parse("Sora"),
      species: PetSpecies.schema.parse("Dog"),
    });
    const updatedPet = await UpdatePetUseCase.create({
      ...common,
      petResolver: petResolverFor([pet]),
      petUpdatedStore: storeEvents(petEvents),
    }).run({
      actorUserId: ids.receptionist,
      petId: ids.pet,
      name: PetName.schema.parse("Mugi II"),
      species: PetSpecies.schema.parse("Cat"),
    });

    expect(createdOwner._unsafeUnwrap().owner.ownerId).toBe(ids.newOwner);
    expect(updatedOwner._unsafeUnwrap().owner.name.unwrap()).toBe("Alice Changed");
    expect(createdPet._unsafeUnwrap().pet).toMatchObject({
      petId: ids.newPet,
      ownerId: ids.owner,
      species: "Dog",
    });
    expect(createdPet._unsafeUnwrap().pet.name.unwrap()).toBe("Sora");
    expect(updatedPet._unsafeUnwrap().pet.name.unwrap()).toBe("Mugi II");
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
    const ownerResolver: OwnerResolverFixture = {
      resolveById: () => {
        touched.push("owner");
        return okAsync(owner);
      },
      resolveAll: () => {
        touched.push("owners");
        return okAsync([owner]);
      },
    };
    const petResolver: PetResolverFixture = {
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

  test("all ten management use cases reject Veterinarian after only actor lookup", async () => {
    const attempts = [
      [
        "create owner",
        (spies: ReturnType<typeof authorizationSpies>) =>
          CreateOwnerUseCase.create({
            userResolver: spies.userResolver,
            ownerCreatedStore: spies.store,
            ownerIdGenerator: spies.ownerIdGenerator,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({ actorUserId: ids.veterinarian, ...changedProfile }),
      ],
      [
        "update owner",
        (spies: ReturnType<typeof authorizationSpies>) =>
          UpdateOwnerUseCase.create({
            userResolver: spies.userResolver,
            ownerResolver: spies.ownerResolver,
            ownerUpdatedStore: spies.store,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({
            actorUserId: ids.veterinarian,
            ownerId: ids.owner,
            ...changedProfile,
          }),
      ],
      [
        "delete owner",
        (spies: ReturnType<typeof authorizationSpies>) =>
          DeleteOwnerUseCase.create({
            userResolver: spies.userResolver,
            ownerResolver: spies.ownerResolver,
            petResolver: spies.petResolver,
            ownerDeletedStore: spies.store,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({ actorUserId: ids.veterinarian, ownerId: ids.owner }),
      ],
      [
        "list owners",
        (spies: ReturnType<typeof authorizationSpies>) =>
          ListOwnersUseCase.create({
            userResolver: spies.userResolver,
            ownerResolver: spies.ownerResolver,
          }).run({ actorUserId: ids.veterinarian }),
      ],
      [
        "get owner",
        (spies: ReturnType<typeof authorizationSpies>) =>
          GetOwnerUseCase.create({
            userResolver: spies.userResolver,
            ownerResolver: spies.ownerResolver,
          }).run({ actorUserId: ids.veterinarian, ownerId: ids.owner }),
      ],
      [
        "create pet",
        (spies: ReturnType<typeof authorizationSpies>) =>
          CreatePetUseCase.create({
            userResolver: spies.userResolver,
            ownerResolver: spies.ownerResolver,
            petCreatedStore: spies.store,
            petIdGenerator: spies.petIdGenerator,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({
            actorUserId: ids.veterinarian,
            ownerId: ids.owner,
            name: PetName.schema.parse("Sora"),
            species: PetSpecies.schema.parse("Dog"),
          }),
      ],
      [
        "update pet",
        (spies: ReturnType<typeof authorizationSpies>) =>
          UpdatePetUseCase.create({
            userResolver: spies.userResolver,
            petResolver: spies.petResolver,
            petUpdatedStore: spies.store,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({
            actorUserId: ids.veterinarian,
            petId: ids.pet,
            name: PetName.schema.parse("Mugi II"),
            species: PetSpecies.schema.parse("Cat"),
          }),
      ],
      [
        "delete pet",
        (spies: ReturnType<typeof authorizationSpies>) =>
          DeletePetUseCase.create({
            userResolver: spies.userResolver,
            petResolver: spies.petResolver,
            appointmentResolver: spies.appointmentResolver,
            petDeletedStore: spies.store,
            clock: spies.clock,
            eventIdGenerator: spies.eventIdGenerator,
          }).run({ actorUserId: ids.veterinarian, petId: ids.pet }),
      ],
      [
        "list pets",
        (spies: ReturnType<typeof authorizationSpies>) =>
          ListPetsUseCase.create({
            userResolver: spies.userResolver,
            petResolver: spies.petResolver,
          }).run({ actorUserId: ids.veterinarian }),
      ],
      [
        "get pet",
        (spies: ReturnType<typeof authorizationSpies>) =>
          GetPetUseCase.create({
            userResolver: spies.userResolver,
            petResolver: spies.petResolver,
          }).run({ actorUserId: ids.veterinarian, petId: ids.pet }),
      ],
    ] as const;

    for (const [name, attempt] of attempts) {
      const spies = authorizationSpies();
      const result = await attempt(spies);
      expect(result._unsafeUnwrapErr(), name).toEqual({
        kind: "Unauthorized",
        actorUserId: ids.veterinarian,
      });
      expect(spies.actorLookups(), name).toBe(1);
      expect(spies.forbiddenTouches, name).toEqual([]);
    }
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
      name: PetName.schema.parse("Sora"),
      species: PetSpecies.schema.parse("Dog"),
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
      assignedVeterinarianId: VeterinarianId.schema.parse(
        "86000000-0000-4000-8000-000000000001",
      ),
      examinationStartedAt: now,
      examId: ExamId.schema.parse("86000000-0000-4000-8000-000000000002"),
      examinationCompletedAt: now,
      diagnosis: Diagnosis.schema.parse("healthy"),
      treatment: Treatment.schema.parse("none"),
      settlement: Settlement.settle(
        scheduled.settlement,
        PaymentAmount.schema.parse(1000),
        now,
      ),
      version: AppointmentVersion.schema.parse(5),
    } as const satisfies Appointment;
    const canceled = {
      ...scheduled,
      appointmentId: AppointmentId.schema.parse(
        "84000000-0000-4000-8000-000000000002",
      ),
      kind: "Canceled",
      cancellationReason: CancellationReason.schema.parse("owner request"),
      version: AppointmentVersion.schema.parse(2),
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

  test("owner queries retain operational PII in Sensitive values", async () => {
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
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
        },
      ],
    });
    expect(ownerDetail._unsafeUnwrap()).toEqual({
      owner: owners._unsafeUnwrap().owners[0],
    });
    expect(pets._unsafeUnwrap()).toEqual({
      pets: [pet],
    });
    expect(Object.keys(ownerDetail._unsafeUnwrap().owner).sort()).toEqual([
      "email",
      "name",
      "ownerId",
      "phone",
    ]);
    expect(JSON.stringify([owners, ownerDetail, pets])).not.toContain(
      "alice@example.test",
    );
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
    db.insert(petsTable).values(petRow(pet)).run();
    db.insert(appointmentsTable)
      .values(appointmentRow(scheduled))
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

  test("guarded stores reject stale targets before any batch write", async () => {
    const ownerDb = createSqliteDatabase(":memory:");
    migrateDatabase(ownerDb);
    ownerDb
      .insert(ownersTable)
      .values({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
        email: owner.email.unwrap(),
        phone: owner.phone.unwrap(),
      })
      .run();
    const ownerResult = await createOwnerDeletedEventStore(ownerDb).store(
      Owner.delete(context(1))(owner),
      Owner.delete(context(2))(otherOwner),
    );

    expect(ownerResult._unsafeUnwrapErr()).toEqual({
      kind: "OwnerNotFound",
      ownerId: ids.otherOwner,
    });
    expect(ownerDb.select().from(ownersTable).all()).toHaveLength(1);
    expect(ownerDb.select().from(domainEventsTable).all()).toEqual([]);

    const petDb = createSqliteDatabase(":memory:");
    migrateDatabase(petDb);
    petDb
      .insert(ownersTable)
      .values({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
        email: owner.email.unwrap(),
        phone: owner.phone.unwrap(),
      })
      .run();
    petDb.insert(petsTable).values(petRow(pet)).run();
    const petResult = await createPetEventStore(petDb).store(
      Pet.delete(context(3))(pet),
      Pet.delete(context(4))({ ...otherPet, ownerId: ids.owner }),
    );

    expect(petResult._unsafeUnwrapErr()).toEqual({
      kind: "PetNotFound",
      petId: ids.otherPet,
    });
    expect(petDb.select().from(petsTable).all()).toHaveLength(1);
    expect(petDb.select().from(domainEventsTable).all()).toEqual([]);
  });

  test("delete use cases map authoritative stale-target errors without PII", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const ownerResult = await DeleteOwnerUseCase.create({
      userResolver: userResolverFor(admin),
      ownerResolver: ownerResolverFor([owner]),
      petResolver: petResolverFor([]),
      ownerDeletedStore: createOwnerDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.admin, ownerId: ids.owner });
    const petResult = await DeletePetUseCase.create({
      userResolver: userResolverFor(admin),
      petResolver: petResolverFor([pet]),
      appointmentResolver: appointmentResolverFor([]),
      petDeletedStore: createPetDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({ actorUserId: ids.admin, petId: ids.pet });

    expect(ownerResult._unsafeUnwrapErr()).toEqual({
      kind: "OwnerNotFound",
      ownerId: ids.owner,
    });
    expect(petResult._unsafeUnwrapErr()).toEqual({
      kind: "PetNotFound",
      petId: ids.pet,
    });
    expect(JSON.stringify([ownerResult, petResult])).not.toContain(
      "alice@example.test",
    );
    expect(db.select().from(domainEventsTable).all()).toEqual([]);
  });

  test("guarded stores reject duplicate aggregate IDs without phantom history", async () => {
    const ownerDb = createSqliteDatabase(":memory:");
    migrateDatabase(ownerDb);
    ownerDb
      .insert(ownersTable)
      .values({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
        email: owner.email.unwrap(),
        phone: owner.phone.unwrap(),
      })
      .run();
    const ownerResult = await createOwnerEventStore(ownerDb).store(
      Owner.delete(context(5))(owner),
      Owner.delete(context(6))(owner),
    );

    expect(ownerResult._unsafeUnwrapErr()).toEqual({
      kind: "OwnerDeletionConflict",
      ownerId: ids.owner,
    });
    expect(ownerDb.select().from(ownersTable).all()).toHaveLength(1);
    expect(ownerDb.select().from(domainEventsTable).all()).toEqual([]);

    const petDb = createSqliteDatabase(":memory:");
    migrateDatabase(petDb);
    petDb
      .insert(ownersTable)
      .values({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
        email: owner.email.unwrap(),
        phone: owner.phone.unwrap(),
      })
      .run();
    petDb.insert(petsTable).values(petRow(pet)).run();
    const petResult = await createPetDeletedEventStore(petDb).store(
      Pet.delete(context(7))(pet),
      Pet.delete(context(8))(pet),
    );

    expect(petResult._unsafeUnwrapErr()).toEqual({
      kind: "PetDeletionConflict",
      petId: ids.pet,
    });
    expect(petDb.select().from(petsTable).all()).toHaveLength(1);
    expect(petDb.select().from(domainEventsTable).all()).toEqual([]);
  });

  test("guarded stores preflight every relationship before multi-delete side effects", async () => {
    const ownerDb = createSqliteDatabase(":memory:");
    migrateDatabase(ownerDb);
    [owner, otherOwner].forEach((state) => {
      ownerDb
        .insert(ownersTable)
        .values({
          ownerId: state.ownerId,
          name: state.name.unwrap(),
          email: state.email.unwrap(),
          phone: state.phone.unwrap(),
        })
        .run();
    });
    ownerDb.insert(petsTable).values(petRow(otherPet)).run();
    const ownerResult = await createOwnerEventStore(ownerDb).store(
      Owner.delete(context(9))(owner),
      Owner.delete(context(10))(otherOwner),
    );

    expect(ownerResult._unsafeUnwrapErr()).toEqual({
      kind: "OwnerHasPets",
      ownerId: ids.otherOwner,
    });
    expect(ownerDb.select().from(ownersTable).all()).toHaveLength(2);
    expect(ownerDb.select().from(domainEventsTable).all()).toEqual([]);

    const petDb = createSqliteDatabase(":memory:");
    migrateDatabase(petDb);
    [owner, otherOwner].forEach((state) => {
      petDb
        .insert(ownersTable)
        .values({
          ownerId: state.ownerId,
          name: state.name.unwrap(),
          email: state.email.unwrap(),
          phone: state.phone.unwrap(),
        })
        .run();
    });
    petDb.insert(petsTable).values([pet, otherPet].map(petRow)).run();
    const otherScheduled = {
      ...scheduled,
      appointmentId: AppointmentId.schema.parse(
          "84000000-0000-4000-8000-000000000002",
      ),
      ownerId: ids.otherOwner,
      petId: ids.otherPet,
    } as const satisfies Appointment;
    petDb
      .insert(appointmentsTable)
      .values(appointmentRow(otherScheduled))
      .run();
    const petResult = await createPetDeletedEventStore(petDb).store(
      Pet.delete(context(11))(pet),
      Pet.delete(context(12))(otherPet),
    );

    expect(petResult._unsafeUnwrapErr()).toEqual({
      kind: "PetHasActiveAppointment",
      petId: ids.otherPet,
    });
    expect(petDb.select().from(petsTable).all()).toHaveLength(2);
    expect(petDb.select().from(domainEventsTable).all()).toEqual([]);
  });
});
