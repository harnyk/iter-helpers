import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

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
