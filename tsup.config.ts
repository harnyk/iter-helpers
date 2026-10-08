import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/main.ts"],
    format: ["esm", "cjs"],
    dts: {
        // tsup injects the deprecated `baseUrl` into its dts build; TS 6 rejects it
        compilerOptions: { ignoreDeprecations: "6.0" },
    },
    clean: true,
    sourcemap: true,
    target: "node22",
});
