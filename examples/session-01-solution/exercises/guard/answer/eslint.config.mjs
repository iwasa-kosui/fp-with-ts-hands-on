import tseslint from "typescript-eslint";

const stateTypes = "Appointment|Scheduled|CheckedIn|InExamination|AwaitingPayment|Paid|Canceled";

const rules = {
  // <型>値 の形の型アサーションを禁止します。
  // 下の selector は as の式だけを検出するため、
  // この形で回避されます。
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as" }],
  "no-restricted-syntax": [
    "error",
    {
      // 「型アサーション（as）で来院済みに偽って渡す」を検出します。
      // 状態の型以外への as を残すコードがあるため、
      // 状態の型だけを対象にします。
      selector: `TSAsExpression > TSTypeReference[typeName.name=/^(${stateTypes})$/]`,
      message: "予約の状態の型へ as で変えず、kind を確認して絞り込みます。",
    },
    {
      // 「unknown を経由して会計でも状態を偽る」を
      // 検出します。
      selector: "TSAsExpression > TSUnknownKeyword",
      message: "unknown を経由した型アサーションで、型検査を回避しません。",
    },
  ],
};

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules,
  },
];
