import { bufferize } from "./Bufferize";
import type { OperatorFunction } from "./Operator";

export function interval<T>(size: number): OperatorFunction<T, [T, T]> {
    return bufferize({
        getInitialValue: (): [T, T] | null => null,
        reducer(acc, value): [T, T] {
            if (acc === null) {
                return [value, value];
            }
            acc[1] = value;
            return acc;
        },
        shouldFlush: (_, __, bufferizedItemsCount) =>
            bufferizedItemsCount >= size,
    }) as OperatorFunction<T, [T, T]>;
}
