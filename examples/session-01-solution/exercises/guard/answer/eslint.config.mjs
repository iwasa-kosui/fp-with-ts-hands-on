import tseslint from "typescript-eslint";

const stateTypes = "Appointment|Scheduled|CheckedIn|InExamination|AwaitingPayment|Paid|Canceled";

const rules = {
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as" }],
  "no-restricted-syntax": [
    "error",
    {
      selector: `TSAsExpression > TSTypeReference[typeName.name=/^(${stateTypes})$/]`,
      message: "予約の状態の型へ as で変えず、kind を確かめて絞り込みます。",
    },
    {
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
