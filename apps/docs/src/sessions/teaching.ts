export type TeachingCode = Readonly<{
  sources: readonly [string, ...string[]];
  code: string;
}>;

export type TeachingTopic = Readonly<{
  name: string;
  definition: string;
  before: TeachingCode;
  after: TeachingCode;
  why: string;
}>;
