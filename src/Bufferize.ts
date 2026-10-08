import { Fifo } from "./Fifo";
import type { Iter } from "./Iter";
import type { OperatorFunction } from "./Operator";

/**
 * Options of `bufferize`: how items are accumulated and when the accumulated
 * value is emitted.
 *
 * @typeParam T - the type of the incoming items
 * @typeParam R - the type of the accumulated (and emitted) value
 */
export interface BufferizeOptions<T, R> {
    /** Creates the initial accumulator: at the start and, unless `getNextInitialValue` is set, after every flush. */
    getInitialValue: () => R;
    /** Creates the accumulator that follows a flush; defaults to `getInitialValue`. */
    getNextInitialValue?: (acc: R) => R;
    /** Folds an incoming item into the accumulator. */
    reducer: (acc: R, value: T) => R;
    /** Decides whether to emit the accumulator after an item; the third argument is the number of items accumulated so far. Defaults to never. */
    shouldFlush?: (acc: R, value: T, bufferizedItemsCount: number) => boolean;
    /** Emits the accumulator this many milliseconds after its first item, even if `shouldFlush` did not fire. */
    timeFrame?: number;
}

/**
 * Creates an operator that accumulates incoming items into a value and emits
 * it when `shouldFlush` returns `true`, when `timeFrame` elapses, or when the
 * source ends. `batch` and `interval` are built on it.
 *
 * Whatever is left in the accumulator when the source ends is emitted as a
 * last value.
 *
 * @param options - see `BufferizeOptions`
 * @returns an operator function
 *
 * @example
 * ```ts
 * const sums = await chain([1, 2, 3, 4, 5])
 *     .bufferize({
 *         getInitialValue: () => 0,
 *         reducer: (acc: number, value: number) => acc + value,
 *         shouldFlush: (_acc, _value, count) => count >= 2,
 *     })
 *     .toArray();
 * // => [3, 7, 5]
 * ```
 */
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
                timeout = setTimeout(() => {
                    flushAcc().catch((error) => {
                        outputQueue.end(error);
                    });
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

        readInput().catch(async (error) => {
            cancelTimeframedFlush();
            try {
                // what was accumulated before the failure is not lost
                if (count > 0) {
                    await flushAcc();
                }
            } catch {
                // the queue is closed or the next accumulator could not be
                // created: the original error is the one to report
            }
            outputQueue.end(error);
        });

        yield* outputQueue;
    };
}
