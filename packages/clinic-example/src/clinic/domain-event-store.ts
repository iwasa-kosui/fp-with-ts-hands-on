import type { ClinicDomainEvent } from "./domain-events.js";

export type DomainEventStore = Readonly<{
  append: (event: ClinicDomainEvent) => void;
  all: () => ReadonlyArray<ClinicDomainEvent>;
}>;

export const createInMemoryDomainEventStore = (
  initial: ReadonlyArray<ClinicDomainEvent> = [],
): DomainEventStore => {
  const events = [...initial];
  return {
    append: (event) => { events.push(event); },
    all: () => [...events],
  };
};
