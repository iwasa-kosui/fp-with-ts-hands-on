import tseslint from "typescript-eslint";

const rules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name='brand']",
      message: "brand を直接呼びません",
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
