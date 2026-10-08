import { Fifo } from "./Fifo";
import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

export interface BufferizeOptions<T, R> {
    getInitialValue: () => R;
    getNextInitialValue?: (acc: R) => R;
    reducer: (acc: R, value: T) => R;
    shouldFlush?: (acc: R, value: T, bufferizedItemsCount: number) => boolean;
    timeFrame?: number;
}

export function bufferize<T, R>({
    getInitialValue,
    getNextInitialValue = getInitialValue,
    reducer,
    shouldFlush = () => false,
    timeFrame,
}: BufferizeOptions<T, R>): OperatorFunction<T, R> {
    return async function* bufferizeOperator(input: Iter<T>): Iter<R> {
        const outputQueue = new Fifo<R>({
            highWatermark: 1,
        });

        let acc: R = getInitialValue();
        let count = 0;
        let timeout: NodeJS.Timeout | null = null;

        function cancelTimeframedFlush() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        }

        function scheduleTimeframedFlush() {
            if (timeFrame && !timeout) {
                timeout = setTimeout(async () => {
                    await flushAcc();
                }, timeFrame);
            }
        }

        async function flushAcc() {
            const result = acc;
            acc = getNextInitialValue(acc);
            count = 0;
            await outputQueue.send(result);
            cancelTimeframedFlush();
        }

        async function readInput() {
            for await (const value of input) {
                scheduleTimeframedFlush();
                acc = reducer(acc, value);
                count++;

                if (shouldFlush(acc, value, count)) {
                    await flushAcc();
                }
            }
            if (count > 0) {
                await flushAcc();
            }
            outputQueue.end();
        }

        readInput();

        yield* outputQueue;
    };
}
