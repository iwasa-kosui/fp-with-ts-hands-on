export type ExamResult = any;

export const ExamResult = {
  parse: (raw: any): ExamResult => raw,
} as const;
