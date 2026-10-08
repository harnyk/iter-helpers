import assert from "node:assert/strict";
import { chain, Fifo, range } from "@harnyk/iter-helpers";

assert.equal(typeof chain, "function");
assert.equal(typeof Fifo, "function");
const out = await chain(range(0, 3))
    .map((x) => x * 2)
    .toArray();
assert.deepEqual(out, [0, 2, 4]);
console.log("esm smoke ok");
