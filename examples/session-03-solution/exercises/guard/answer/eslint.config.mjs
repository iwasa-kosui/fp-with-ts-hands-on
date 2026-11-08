import tseslint from "typescript-eslint";

const rules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-return": "error",
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
