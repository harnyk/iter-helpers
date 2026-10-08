import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that transforms every item with `mapper`.
 *
 * If `mapper` throws and an `errorMapper` is given, the value returned by
 * `errorMapper` is emitted instead and the iteration continues. Without an
 * `errorMapper` the error is rethrown to the consumer.
 *
 * @param mapper - transforms an item; may be asynchronous
 * @param errorMapper - turns an error thrown by `mapper` into a value; may be asynchronous
 * @returns an operator function
 *
 * @example
 * ```ts
 * const result = await chain([1, 2, 3])
 *     .map(
 *         (n) => {
 *             if (n === 2) {
 *                 throw new Error("two");
 *             }
 *             return n * 10;
 *         },
 *         (n) => -n,
 *     )
 *     .toArray();
 * // => [10, -2, 30]
 * ```
 */
export function map<Input, Output, ErrorOutput = never>(
    mapper: (input: Input) => Output | Promise<Output>,
    errorMapper?: (
        input: Input,
        error: unknown,
    ) => ErrorOutput | Promise<ErrorOutput>,
): OperatorFunction<Input, Output | ErrorOutput> {
    return async function* mapOperator(
        input: Iter<Input>,
    ): Iter<Output | ErrorOutput> {
        for await (const value of input) {
            let result: Output;
            try {
                result = await mapper(value);
            } catch (error) {
                if (!errorMapper) {
                    throw error;
                }
                yield await errorMapper(value, error);
                continue;
            }
            yield result;
        }
    };
}
