import { bufferize } from "./Bufferize";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that splits the source into groups of `size` items and
 * emits only the first and the last item of each group as a pair. The last
 * group may be smaller; a group of one item yields that item twice.
 *
 * If the source throws, the interval collected so far is emitted first and
 * the error is thrown after it.
 *
 * @param size - the number of items in a group
 * @returns an operator function
 *
 * @example
 * ```ts
 * const result = await chain(["a", "b", "c", "d", "e", "f", "g"])
 *     .interval(3)
 *     .toArray();
 * // => [["a", "c"], ["d", "f"], ["g", "g"]]
 * ```
 */
export function interval<T>(size: number): OperatorFunction<T, [T, T]> {
    return bufferize({
        getInitialValue: (): [T, T] | null => null,
        reducer(acc, value): [T, T] {
            if (acc === null) {
                return [value, value];
            }
            acc[1] = value;
            return acc;
        },
        shouldFlush: (_, __, bufferizedItemsCount) =>
            bufferizedItemsCount >= size,
    }) as OperatorFunction<T, [T, T]>;
}
