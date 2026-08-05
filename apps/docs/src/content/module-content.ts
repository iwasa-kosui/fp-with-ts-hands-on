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
  | Readonly<{ kind: "checklist"; heading: string; items: readonly string[] }>
  | Readonly<{
      kind: "overview";
      heading: string;
      introduction: string;
      items: readonly Readonly<{ title: string; description: string }>[];
    }>
  | Readonly<{
      kind: "value-map";
      heading: string;
      introduction: string;
      rows: readonly Readonly<{
        function: string;
        audiences: string;
        value: string;
      }>[];
    }>;

type OnboardingSectionBase = Readonly<{ id: string; heading: string }>;

export type OnboardingChapter = Readonly<{
  id: string;
  heading: string;
  sections: readonly OnboardingSection[];
}>;

export type OnboardingSection =
  | (OnboardingSectionBase &
      Readonly<{ kind: "business-context"; paragraphs: readonly string[] }>)
  | (OnboardingSectionBase &
      Readonly<{
        kind: "visit-flow";
        introduction: string;
        steps: readonly Readonly<{ title: string; description: string }>[];
        people: Readonly<{
          id: string;
          heading: string;
          items: readonly Readonly<{ name: string; description: string }>[];
        }>;
      }>)
  | (OnboardingSectionBase &
      Readonly<{
        kind: "value-map";
        introduction: string;
        rows: readonly Readonly<{ function: string; audiences: string; value: string }>[];
      }>)
  | (OnboardingSectionBase &
      Readonly<{
        kind: "visit-model";
        introduction: string;
        states: readonly Readonly<{ label: string; code: string }>[];
        rule: string;
      }>)
  | (OnboardingSectionBase &
      Readonly<{
        kind: "developer-guide";
        introduction: string;
        items: readonly Readonly<{ title: string; description: string }>[];
      }>);

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
  onboarding?: OnboardingChapter;
  blocks: readonly ContentBlock[];
  finalActionPlan?: Readonly<{
    implementationPrompt: string;
    firstActionPrompt: string;
  }>;
}>;

const isBlank = (value: string): boolean => value.trim().length === 0;

const isEmptyOrHasBlank = (values: readonly string[]): boolean =>
  values.length === 0 || values.some(isBlank);

export const assertModuleMeetsPrd = (module: ModuleContent): void => {
  const triggerDetail =
    module.trigger.kind === "incident"
      ? module.trigger.incident
      : module.trigger.kind === "new-requirement"
        ? module.trigger.requirement
        : module.trigger.reviewProblem;

  if (
    isBlank(module.trigger.situation) ||
    isBlank(triggerDetail) ||
    isBlank(module.invariant) ||
    isBlank(module.mission)
  ) {
    throw new Error(`PRD-02: ${module.id}`);
  }
  if (
    module.editTargets.length > 2 ||
    module.editTargets.some(({ file, symbol }) => isBlank(file) || isBlank(symbol))
  ) {
    throw new Error(`PRD-06: ${module.id}`);
  }
  if (isBlank(module.technique.name) || isBlank(module.technique.reason)) {
    throw new Error(`PRD-04: ${module.id}`);
  }
  if (isBlank(module.technique.limits)) throw new Error(`PRD-05: ${module.id}`);
  if (
    isBlank(module.red.command) ||
    isBlank(module.red.expected) ||
    module.filesToRead.length === 0 ||
    module.filesToRead.some(({ file, focus }) => isBlank(file) || isBlank(focus))
  ) {
    throw new Error(`PRD-03: ${module.id}`);
  }
  if (
    isBlank(module.green.command) ||
    isBlank(module.green.expected) ||
    isBlank(module.changeImpact) ||
    isEmptyOrHasBlank(module.reviewPoints) ||
    isEmptyOrHasBlank(module.doneWhen)
  ) {
    throw new Error(`PRD-07: ${module.id}`);
  }
  if (isEmptyOrHasBlank(module.reflectionQuestions)) throw new Error(`PRD-08: ${module.id}`);
  if (
    isBlank(module.fallbackGuidance) ||
    module.workedExamples.length === 0 ||
    module.workedExamples.some(
      ({ file, symbols }) => isBlank(file) || isEmptyOrHasBlank(symbols),
    )
  ) {
    throw new Error(`PRD-12: ${module.id}`);
  }
};
