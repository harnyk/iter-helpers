import { type Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that calls `cb` once, after the source has been
 * iterated to its end. It is not called if the consumer stops early or the
 * source throws.
 *
 * @param cb - called once at the end of the iteration
 * @returns an operator function
 *
 * @see {@link tap} for an example
 */
export function onEnd<T>(cb: () => void): OperatorFunction<T, T> {
    return async function* onEndOperator(input: Iter<T>): Iter<T> {
        for await (const v of input) {
            yield v;
        }
        cb();
    };
}
