import type { ExaminationStarted } from "../domain/examination-started.js";
import type { DomainEventStore } from "../ports/domain-event-store.js";

export const createInMemoryDomainEventStore = (): DomainEventStore => {
  const events: Array<ExaminationStarted> = [];

  return {
    append: (event) => {
      events.push(event);
    },
    all: () => [...events],
  };
};
