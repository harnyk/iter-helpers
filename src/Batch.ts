import { bufferize } from "./Bufferize";
import type { OperatorFunction } from "./Operator";

/**
 * Options of `batch`: a maximum batch `size`, a `timeFrame` in milliseconds
 * after which a partial batch is emitted, or both.
 */
export type BatchOptions =
    | { size: number }
    | { timeFrame: number }
    | { size: number; timeFrame: number };

/**
 * Creates an operator that groups items into arrays.
 *
 * A number is a shortcut for the `size` option. A batch is emitted when it
 * reaches `size` items or, if `timeFrame` is set, that many milliseconds
 * after its first item. The remainder at the end of the source is emitted as
 * a smaller batch.
 *
 * @param sizeOrOptions - the batch size or `BatchOptions`
 * @returns an operator function
 *
 * @example
 * ```ts
 * await chain(range(0, 5)).batch(2).toArray();
 * // => [[0, 1], [2, 3], [4]]
 *
 * async function* slow() {
 *     yield 1;
 *     await sleep(150);
 *     yield 2;
 * }
 * await chain(slow()).batch({ size: 10, timeFrame: 50 }).toArray();
 * // => [[1], [2]]
 * ```
 */
export function batch<T>(
    sizeOrOptions: number | BatchOptions,
): OperatorFunction<T, T[]> {
    const options =
        typeof sizeOrOptions === "number"
            ? { size: sizeOrOptions }
            : sizeOrOptions;

    let size = Infinity;
    let timeFrame = undefined;

    if ("size" in options) {
        size = options.size;
    }

    if ("timeFrame" in options) {
        timeFrame = options.timeFrame;
    }

    return bufferize({
        timeFrame,
        getInitialValue: (): T[] => [],
        reducer(acc, value) {
            acc.push(value);
            return acc;
        },
        shouldFlush: (acc) => acc.length >= size,
    });
}
