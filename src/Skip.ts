import { type Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that drops the first `size` items and passes through
 * the rest.
 *
 * @param size - the number of items to drop
 * @returns an operator function
 *
 * @example
 * ```ts
 * const result = await chain([1, 2, 3, 4, 5]).skip(2).toArray();
 * // => [3, 4, 5]
 * ```
 */
export function skip<T>(size: number): OperatorFunction<T, T> {
    return async function* skipOperator(input: Iter<T>): Iter<T> {
        let skipped = 0;
        for await (const value of input) {
            if (skipped >= size) {
                yield value;
            } else {
                skipped++;
            }
        }
    };
}
