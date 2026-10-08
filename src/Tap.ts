import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that calls `tapper` for every item and passes the item
 * through unchanged. An asynchronous `tapper` is awaited before the item is
 * passed on.
 *
 * @param tapper - a side effect to run for every item
 * @returns an operator function
 *
 * @example
 * ```ts
 * const log: string[] = [];
 * const result = await chain(["a", "b"])
 *     .tap((s) => {
 *         log.push(`saw ${s}`);
 *     })
 *     .onEnd(() => {
 *         log.push("done");
 *     })
 *     .toArray();
 * // result => ["a", "b"]
 * // log => ["saw a", "saw b", "done"]
 * ```
 */
export function tap<T>(
    tapper: (input: T) => void | Promise<void>,
): OperatorFunction<T, T> {
    return async function* tapOperator(input: Iter<T>): Iter<T> {
        for await (const value of input) {
            await tapper(value);
            yield value;
        }
    };
}
