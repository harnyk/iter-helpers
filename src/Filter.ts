import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Creates an operator that keeps only the items for which `predicate`
 * returns `true`.
 *
 * The predicate must be synchronous and must be a type predicate
 * (`value is Output`), so the chain method `filter` can narrow the item type.
 *
 * @param predicate - a synchronous type predicate
 * @returns an operator function
 *
 * @example
 * ```ts
 * const mixed: (number | string)[] = [1, "a", 2, "b"];
 * const numbers = await chain(mixed)
 *     .filter((v): v is number => typeof v === "number")
 *     .toArray();
 * // => [1, 2]
 * ```
 */
export function filter<Input, Output extends Input>(
    predicate: (value: Input) => value is Output,
): OperatorFunction<Input, Input> {
    return async function* filterOperator(input: Iter<Input>): Iter<Input> {
        for await (const value of input) {
            if (predicate(value)) {
                yield value;
            }
        }
    };
}
