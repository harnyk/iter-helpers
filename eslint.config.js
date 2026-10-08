import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tsdoc from "eslint-plugin-tsdoc";

export default tseslint.config(
    { ignores: ["dist", "lib", "coverage", "node_modules", "docs", "website"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        // the CJS smoke test deliberately checks the `require()` entry point
        files: ["**/*.cjs"],
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
    {
        files: ["src/**/*.ts"],
        ignores: ["src/tests/**"],
        plugins: { tsdoc },
        rules: { "tsdoc/syntax": "error" },
    },
);
