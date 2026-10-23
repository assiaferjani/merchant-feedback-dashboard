import react from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.js", "e2e/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.worker, ...globals.node },
    },
    plugins: { react, "unused-imports": unusedImports },
    settings: { react: { version: "18.3" } },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        { args: "none", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "react/jsx-no-undef": "error",
      "react/jsx-uses-vars": "error",
      "unused-imports/no-unused-imports": "error",
    },
  },
];
