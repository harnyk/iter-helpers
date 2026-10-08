import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = join(
    dirname(fileURLToPath(import.meta.url)),
    "check-snippets.mjs",
);

function run(markdown, ...args) {
    const dir = mkdtempSync(join(tmpdir(), "snippets-"));
    try {
        writeFileSync(join(dir, "page.md"), markdown);
        mkdirSync(join(dir, "api"));
        // blocks under api/ are generated and must be ignored
        writeFileSync(
            join(dir, "api", "ignored.md"),
            "```ts\nconst x: number = 'no';\n```\n",
        );
        return spawnSync(process.execPath, [script, dir, ...args], {
            encoding: "utf8",
        });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test("passes for a block that type-checks, with and without an import", () => {
    const result = run(
        [
            "```ts",
            'import { chain } from "@harnyk/iter-helpers";',
            "const a: number[] = await chain([1, 2]).toArray();",
            "```",
            "",
            "```ts",
            "const b: number[] = await chain([1, 2]).map((n) => n * 2).toArray();",
            "```",
            "",
        ].join("\n"),
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("fails with the file and line of a block that does not type-check", () => {
    const result = run(
        [
            "text",
            "",
            "```ts",
            "const n: number = await chain([1]).toArray();",
            "```",
            "",
        ].join("\n"),
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /page\.md:4/);
});

test("ignores blocks of other languages when an empty run is allowed", () => {
    const result = run(
        "```bash\nthis is not typescript\n```\n",
        "--allow-empty",
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("fails when there is nothing to check, so the gate cannot go silent", () => {
    const result = run("```bash\nthis is not typescript\n```\n");
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /no ts snippets/i);
});

test("checks blocks written as typescript or with a title", () => {
    for (const fence of ["```typescript", '```ts title="a.ts"', "```ts {1}"]) {
        const result = run(`${fence}\nconst n: number = "x";\n\`\`\`\n`);
        assert.equal(result.status, 1, `${fence}: ${result.stdout}`);
    }
});
