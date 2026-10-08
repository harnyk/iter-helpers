// Type-checks every ```ts block of the guides against src/main.ts.
import { spawnSync } from "node:child_process";
import {
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(websiteDir, "..");
const docsDir = resolve(process.argv[2] ?? join(websiteDir, "docs"));
const workDir = join(websiteDir, ".snippets");

const HEADER =
    'import { chain, range, mux, Fifo, type Iter } from "@harnyk/iter-helpers";\n';

function* markdownFiles(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            // the API reference is generated from the TSDoc: skipped
            if (name !== "api") {
                yield* markdownFiles(path);
            }
        } else if (name.endsWith(".md")) {
            yield path;
        }
    }
}

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

const origins = new Map();
let count = 0;
for (const file of markdownFiles(docsDir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "```ts") {
            continue;
        }
        const start = i + 1;
        const body = [];
        for (i = start; i < lines.length && lines[i].trim() !== "```"; i++) {
            body.push(lines[i]);
        }
        const code = body.join("\n");
        // a block with its own import is checked as it is
        const hasImport = code.includes('from "@harnyk/iter-helpers"');
        count++;
        const name = `snippet-${String(count).padStart(3, "0")}.ts`;
        writeFileSync(
            join(workDir, name),
            `${hasImport ? "" : HEADER}${code}\nexport {};\n`,
        );
        // the line of the first code line, 1-based
        origins.set(name, `${relative(docsDir, file)}:${start + 1}`);
    }
}

if (count === 0) {
    console.log("no snippets to check");
    rmSync(workDir, { recursive: true, force: true });
    process.exit(0);
}

writeFileSync(
    join(workDir, "tsconfig.json"),
    JSON.stringify({
        compilerOptions: {
            target: "es2023",
            lib: ["es2023"],
            module: "esnext",
            moduleResolution: "bundler",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
            types: ["node"],
            typeRoots: [join(websiteDir, "node_modules", "@types")],
            paths: {
                "@harnyk/iter-helpers": [join(repoRoot, "src", "main.ts")],
            },
        },
        include: ["./*.ts"],
    }),
);

const tsc = join(websiteDir, "node_modules", ".bin", "tsc");
const result = spawnSync(tsc, ["-p", join(workDir, "tsconfig.json")], {
    encoding: "utf8",
});

if (result.status === 0) {
    console.log(`${count} snippets type-check`);
    rmSync(workDir, { recursive: true, force: true });
    process.exit(0);
}

const output = (result.stdout ?? "") + (result.stderr ?? "");
for (const line of output.split("\n").filter(Boolean)) {
    const name = /(snippet-\d+\.ts)/.exec(line)?.[1];
    console.error(name ? `${origins.get(name)}: ${line}` : line);
}
process.exit(1);
