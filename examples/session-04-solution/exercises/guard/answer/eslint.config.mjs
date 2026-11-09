import tseslint from "typescript-eslint";

const rules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "VariableDeclarator[id.name='startExamination'] ThrowStatement",
      message: "throw しません。失敗は err で返します。",
    },
    {
      selector: "CallExpression[callee.property.name='_unsafeUnwrap']",
      message: "_unsafeUnwrap は失敗のとき例外を投げます。",
    },
  ],
  "@typescript-eslint/switch-exhaustiveness-check": [
    "error",
    { considerDefaultExhaustiveForUnions: false },
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
