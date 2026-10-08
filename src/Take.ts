import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

export function take<T>(size: number): OperatorFunction<T, T> {
    return async function* takeOperator(input: Iter<T>): Iter<T> {
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
