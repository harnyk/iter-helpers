const assert = require("node:assert/strict");
const { chain, Fifo, range } = require("@harnyk/iter-helpers");

(async () => {
    assert.equal(typeof chain, "function");
    assert.equal(typeof Fifo, "function");
    const out = await chain(range(0, 3))
        .map((x) => x * 2)
        .toArray();
    assert.deepEqual(out, [0, 2, 4]);
    console.log("cjs smoke ok");
})();
