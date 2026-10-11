import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
    },
  },
);
