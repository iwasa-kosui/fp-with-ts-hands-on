import tseslint from "typescript-eslint";

const rules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: "現在時刻を直接読まず、clock から受け取ります。",
    },
    {
      selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
      message: "ID を直接作らず、ID generator から受け取ります。",
    },
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: "現在時刻を直接読まず、clock から受け取ります。",
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
