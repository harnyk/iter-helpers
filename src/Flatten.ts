import type { Iter } from "./Iter";

/**
 * An operator that turns an iteration of arrays into an iteration of their
 * items. Usually used as the chain method `flatten()`.
 *
 * @example
 * ```ts
 * const result = await chain([[1, 2], [3], [4, 5]])
 *     .flatten()
 *     .toArray();
 * // => [1, 2, 3, 4, 5]
 * ```
 */
export async function* flatten<T>(input: Iter<T[]>): Iter<T> {
    for await (const items of input) {
        for (const item of items) {
            yield item;
        }
    }
}
