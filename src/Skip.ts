import { type Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

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
