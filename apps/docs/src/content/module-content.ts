export type ModuleTrigger =
  | Readonly<{ kind: "incident"; situation: string; incident: string }>
  | Readonly<{ kind: "new-requirement"; situation: string; requirement: string }>
  | Readonly<{ kind: "review"; situation: string; reviewProblem: string }>;

export type ContentBlock =
  | Readonly<{ kind: "prose"; heading: string; paragraphs: readonly string[] }>
  | Readonly<{ kind: "code"; heading: string; language: string; code: string }>
  | Readonly<{ kind: "command"; phase: "red" | "green"; command: string; expected: string }>
  | Readonly<{
      kind: "file-table";
      heading: string;
      rows: readonly Readonly<{ file: string; focus: string; mode: "read" | "edit" }>[];
    }>
  | Readonly<{ kind: "checklist"; heading: string; items: readonly string[] }>;

export type ModuleContent = Readonly<{
  id: string;
  slug: string;
  label: string;
  title: string;
  durationMinutes: number;
  caseStudy: Readonly<{
    animalName: string;
    animalType: string;
    avatar: string;
    context: string;
  }>;
  trigger: ModuleTrigger;
  invariant: string;
  mission: string;
  technique: Readonly<{ name: string; reason: string; limits: string }>;
  editTargets: readonly Readonly<{ file: string; symbol: string }>[];
  red: Readonly<{ command: string; expected: string }>;
  green: Readonly<{ command: string; expected: string }>;
  filesToRead: readonly Readonly<{ file: string; focus: string }>[];
  reviewPoints: readonly string[];
  doneWhen: readonly string[];
  changeImpact: string;
  reflectionQuestions: readonly string[];
  fallbackGuidance: string;
  workedExamples: readonly Readonly<{ file: string; symbols: readonly string[] }>[];
  resources: readonly Readonly<{ label: string; href: string }>[];
  blocks: readonly ContentBlock[];
  finalActionPlan?: Readonly<{
    implementationPrompt: string;
    firstActionPrompt: string;
  }>;
}>;

const isBlank = (value: string): boolean => value.trim().length === 0;

export const assertModuleMeetsPrd = (module: ModuleContent): void => {
  const triggerDetail =
    module.trigger.kind === "incident"
      ? module.trigger.incident
      : module.trigger.kind === "new-requirement"
        ? module.trigger.requirement
        : module.trigger.reviewProblem;

  if (isBlank(module.trigger.situation) || isBlank(triggerDetail) || isBlank(module.invariant)) {
    throw new Error(`PRD-02: ${module.id}`);
  }
  if (module.editTargets.length > 2) throw new Error(`PRD-06: ${module.id}`);
  if (isBlank(module.technique.reason)) throw new Error(`PRD-04: ${module.id}`);
  if (isBlank(module.technique.limits)) throw new Error(`PRD-05: ${module.id}`);
  if (isBlank(module.red.command) || isBlank(module.red.expected)) throw new Error(`PRD-03: ${module.id}`);
  if (isBlank(module.green.command) || isBlank(module.green.expected) || isBlank(module.changeImpact)) {
    throw new Error(`PRD-07: ${module.id}`);
  }
  if (module.reflectionQuestions.length === 0) throw new Error(`PRD-08: ${module.id}`);
  if (isBlank(module.fallbackGuidance) || module.workedExamples.length === 0) {
    throw new Error(`PRD-12: ${module.id}`);
  }
};
