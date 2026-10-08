/**
 * Creates a range generator
 * @param start - the start of the range. Inclusive.
 * @param end - the end of the range. Exclusive. Optional
 * @param step - the step. Optional
 */
export function* range(
    start = 0,
    end?: number,
    step?: number,
): Generator<number> {
    if (end === start) {
        return;
    }
    const ascending = end === undefined || end > start;

    step ??= ascending ? 1 : -1;

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
