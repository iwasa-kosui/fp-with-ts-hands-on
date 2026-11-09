import tseslint from "typescript-eslint";

const rules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        { group: ["**/adaptor/**"], message: "domain は adaptor を import しません。" },
        { group: ["**/useCase/**"], message: "domain は useCase を import しません。" },
      ],
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
