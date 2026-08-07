import type { ExaminationStarted } from "../domain/examination-started.js";

export type DomainEventStore = Readonly<{
  append: (event: ExaminationStarted) => void;
  all: () => ReadonlyArray<ExaminationStarted>;
}>;
