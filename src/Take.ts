import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that passes through only the first `size` items and then
 * stops iterating the source.
 *
 * A `size` of 0 or less gives an empty iteration and the source is not read.
 *
 * @param size - the number of items to take
 * @returns an operator function
 *
 * @example
 * ```ts
 * const result = await chain([1, 2, 3, 4, 5]).take(2).toArray();
 * // => [1, 2]
 * ```
 */
export function take<T>(size: number): OperatorFunction<T, T> {
    return async function* takeOperator(input: Iter<T>): Iter<T> {
        if (size <= 0) {
            return;
        }
        let taken = 0;
        for await (const value of input) {
            yield value;
            taken++;
            if (taken >= size) {
                break;
            }
        }
    };
}
