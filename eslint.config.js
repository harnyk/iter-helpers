import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
    { ignores: ["dist", "lib", "coverage", "node_modules", "docs"] },
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
);
