const aggregateLabels: Readonly<Record<string, string>> = {
  Appointment: "予約",
  Audit: "監査",
  ExamResult: "診察結果",
  FollowUp: "フォローアップ",
  Owner: "飼い主",
  Pet: "ペット",
  Session: "セッション",
  User: "ユーザー",
};

export const aggregatePresentation = (aggregateName: string): string =>
  aggregateLabels[aggregateName] ?? "対象データ";
