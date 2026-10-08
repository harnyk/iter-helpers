/**
 * Creates a generator of numbers.
 *
 * Without `end` the range is endless (combine it with `take`). With `end`
 * the direction is taken from `start` and `end`; the default step is `1` for
 * an ascending range and `-1` for a descending one. An explicit `step` that
 * points away from `end` gives an empty range; a `step` of 0 throws a
 * `RangeError` when the iteration starts.
 *
 * @param start - the first number, inclusive; defaults to 0
 * @param end - the end of the range, exclusive; omit for an endless range
 * @param step - the distance between numbers
 * @returns a generator of numbers
 *
 * @example
 * ```ts
 * [...range(0, 3)]; // => [0, 1, 2]
 * [...range(0, 10, 5)]; // => [0, 5]
 * [...range(3, 0)]; // => [3, 2, 1]
 * [...range(0, 5, -1)]; // => []
 * await chain(range(1)).take(3).toArray(); // => [1, 2, 3]
 * ```
 */
export function* range(
    start = 0,
    end?: number,
    step?: number,
): Generator<number> {
    if (step === 0) {
        throw new RangeError("range: step must not be 0");
    }
    if (end === start) {
        return;
    }
    const ascending = end === undefined || end > start;

    step ??= ascending ? 1 : -1;

    // a step that points away from the end can never reach it
    if (end !== undefined && (ascending ? step < 0 : step > 0)) {
        return;
    }

    if (end === undefined) {
        for (let i = start; ; i += step) {
            yield i;
        }
    } else {
        for (let i = start; ascending ? i < end : i > end; i += step) {
            yield i;
        }
    }
}
