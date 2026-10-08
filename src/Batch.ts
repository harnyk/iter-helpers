import { bufferize } from "./Bufferize";
import type { OperatorFunction } from "./Operator";

export type BatchOptions =
    | { size: number }
    | { timeFrame: number }
    | { size: number; timeFrame: number };

export function batch<T>(
    sizeOrOptions: number | BatchOptions,
): OperatorFunction<T, T[]> {
    const options =
        typeof sizeOrOptions === "number"
            ? { size: sizeOrOptions }
            : sizeOrOptions;

    let size = Infinity;
    let timeFrame = undefined;

    if ("size" in options) {
        size = options.size;
    }

    if ("timeFrame" in options) {
        timeFrame = options.timeFrame;
    }

    return bufferize({
        timeFrame,
        getInitialValue: (): T[] => [],
        reducer(acc, value) {
            acc.push(value);
            return acc;
        },
        shouldFlush: (acc) => acc.length >= size,
    });
}
