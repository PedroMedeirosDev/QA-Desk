import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "data/**",
      "public/**",
      "e2e/test-results/**",
      "e2e/playwright-report/**",
      "e2e/blob-report/**",
      "test-results/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Prefixo "_" marca o que fica sem uso de propósito (desestruturação para descartar campos, middlewares do Express).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Augmentation do Request do Express usa `declare global { namespace Express }`.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: [
      "server/**/*.ts",
      "scripts/**/*.{ts,mjs,js}",
      "agent/**/*.ts",
      "e2e/**/*.ts",
      "supabase/**/*.{mjs,js,ts}",
      "*.{js,ts,mjs}",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Remoção de cores ANSI (\x1b) do log do Maestro.
    files: ["server/maestro-progress.ts", "src/lib/maestro-output.ts", "src/lib/maestro-progress.ts"],
    rules: { "no-control-regex": "off" },
  },
);
