import assert from "node:assert/strict";
import { test } from "node:test";
import { distTag } from "./dist-tag.mjs";

test("prerelease versions go to rc", () => {
    assert.equal(distTag("1.0.0-rc.0"), "rc");
    assert.equal(distTag("1.0.0-rc.12"), "rc");
});

test("stable versions go to latest", () => {
    assert.equal(distTag("1.0.0"), "latest");
    assert.equal(distTag("1.2.3"), "latest");
});

test("invalid versions throw", () => {
    assert.throws(() => distTag("v1.0.0"));
    assert.throws(() => distTag(""));
});
