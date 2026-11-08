import tseslint from "typescript-eslint";

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: {},
  },
];
