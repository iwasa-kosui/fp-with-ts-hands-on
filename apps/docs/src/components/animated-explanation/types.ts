export type Frame = Readonly<{
  show?: string;
  hide?: string;
  hi?: string;
  mark?: Readonly<Record<string, string>>;
  place?: Readonly<Record<string, string>>;
  set?: Readonly<Record<string, string>>;
}>;

export type AnimationStep = Readonly<{ text: string }> & Frame;

export type AnimationScenario = Readonly<{
  id: string;
  label: string;
  steps: readonly AnimationStep[];
}>;

export type Animation = Readonly<{
  id: string;
  title: string;
  lead: string;
  note?: string;
  scene: string;
  scenarios: readonly AnimationScenario[];
}>;
