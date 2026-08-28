export type SessionKind = "orientation" | "workshop" | "exercise" | "reference";

export type SessionLink = Readonly<{ href: string; title: string }>;

export type SessionNavigation = Readonly<{
  previous: SessionLink | undefined;
  next: SessionLink | undefined;
}>;

export type SolutionPresentation = "excerpt" | "completed-file";

export type ExerciseModule = Readonly<{
  dir: string;
  fileBudget: number;
  lineBudget: number;
}>;

export type ExerciseStep = Readonly<{
  id: string;
  goal: string;
  targets: readonly string[];
  solutions: readonly [SolutionReference, ...SolutionReference[]];
}>;

export type SolutionReference = Readonly<{
  path: string;
  symbol: string;
  lines: readonly [number, number];
  presentation?: SolutionPresentation;
}>;

export type Decision = Readonly<{
  invariant: string;
}>;

export type AdvBreakdown = Readonly<{
  articulate: number;
  delegate: number;
  verify: number;
}>;

export type DelegationPrompt = Readonly<{
  request: string;
  decisions: readonly [string, ...string[]];
}>;

export type TimeBreakdown = Readonly<{
  brief: number;
  teach: number;
  exercise: number;
  review: number;
}>;

export type PeerReview = Readonly<{
  minutes: number;
  pickCount: 1 | 2;
  questions: readonly string[];
}>;

type SessionSummaryBase = Readonly<{
  slug: string;
  sequence: "00" | "01" | "02" | "03" | "04" | "05" | "06" | "Final";
  title: string;
  durationMinutes: number;
  timeBreakdown: TimeBreakdown;
  adv?: AdvBreakdown;
  delegationPrompt?: DelegationPrompt;
  peerReview?: PeerReview;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
  episode: readonly [string, string, string];
  incident: string;
  exerciseCommand?: string;
  exerciseModule?: ExerciseModule;
  solutionSnapshot?: ExampleSnapshot;
  solutionPresentation?: SolutionPresentation;
  peerReviewPromises?: "inline" | "reference";
  steps: readonly ExerciseStep[];
  decisions: readonly Decision[];
  finalReferences: readonly string[];
}>;

export type ExerciseSessionSummary = SessionSummaryBase &
  Readonly<{
    kind: "exercise";
    snapshot: PublicCodeExplorerSnapshot;
    adv: AdvBreakdown;
    delegationPrompt: DelegationPrompt;
    peerReview: PeerReview;
    exerciseCommand: string;
    exerciseModule: ExerciseModule;
    solutionSnapshot: ExampleSnapshot;
    solutionPresentation: SolutionPresentation;
    peerReviewPromises: "inline" | "reference";
  }>;

type NonExerciseMetadata = Readonly<{
  adv?: never;
  delegationPrompt?: never;
  peerReview?: never;
  exerciseCommand?: never;
  exerciseModule?: never;
  solutionSnapshot?: never;
  solutionPresentation?: never;
  peerReviewPromises?: never;
}>;

type SnapshotSessionSummary = SessionSummaryBase &
  NonExerciseMetadata &
  Readonly<{
    kind: "orientation" | "reference";
    snapshot: PublicCodeExplorerSnapshot;
  }>;

type WorkshopSessionSummary = SessionSummaryBase &
  NonExerciseMetadata &
  Readonly<{
    kind: "workshop";
    snapshot?: never;
  }>;

export type SessionSummary =
  ExerciseSessionSummary | SnapshotSessionSummary | WorkshopSessionSummary;

export type ExampleSnapshot =
  | "session-00"
  | "session-01"
  | "session-02"
  | "session-03"
  | "session-04"
  | "session-05"
  | "session-06"
  | "session-07"
  | "final";

export type PublicCodeExplorerSnapshot = Exclude<
  ExampleSnapshot,
  "session-01" | "session-07"
>;
