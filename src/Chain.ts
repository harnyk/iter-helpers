import type { BatchOptions } from "./Batch";
import { batch } from "./Batch";
import type { ConcurrentMapOptions } from "./ConcurrentMap";
import { concurrentMap } from "./ConcurrentMap";
import { filter } from "./Filter";
import { flatten } from "./Flatten";
import { interval } from "./Interval";
import type { Iter } from "./Iter";
import { map } from "./Map";
import type { Operator } from "./Operator";
import type { BufferizeOptions } from "./Bufferize";
import { bufferize } from "./Bufferize";
import { skip } from "./Skip";
import { take } from "./Take";
import { tap } from "./Tap";
import { onEnd } from "./OnEnd";

/**
 * A chain of operators over an `Iter`, created with `chain`. Every method that
 * applies an operator returns a new chain; the chain is an `AsyncIterable`.
 */
export class Chain<I> implements AsyncIterable<I> {
    constructor(private source: Iter<I>) {}

    async *[Symbol.asyncIterator]() {
        yield* this.source;
    }

    /**
     * Pipes the values through an operator
     *
     * An operator is a function receiving one `Iter` and returning
     * another `Iter`.
     *
     * Also, for convenience, an operator can be an object with a `process` method,
     * which is an operator function itself.
     *
     * @example
     * ```ts
     * function double(source: Iter<number>): Iter<number> {
     *     return (async function* () {
     *         for await (const n of source) {
     *             yield n * 2;
     *         }
     *     })();
     * }
     *
     * await chain([1, 2]).pipe(double).toArray(); // => [2, 4]
     * await chain([1, 2]).pipe({ process: double }).toArray(); // => [2, 4]
     * ```
     */
    pipe<O>(op: Operator<I, O>) {
        if (typeof op === "function") {
            return new Chain<O>(op(this.source));
        } else {
            return new Chain<O>(op.process(this.source));
        }
    }
    /**
     * Starts the iteration. Resolves when the iteration is done.
     *
     * Optionally, a callback can be provided.
     * It will be called for each item in the iteration.
     *
     * @example
     * ```ts
     * const seen: number[] = [];
     * await chain([1, 2, 3]).consume((n) => {
     *     seen.push(n);
     * });
     * // seen => [1, 2, 3]
     * ```
     */
    async consume(callback?: (value: I) => void | Promise<void>) {
        for await (const value of this.source) {
            await callback?.(value);
        }
    }

    /**
     * When the iteration is done, resolves to an array of all the items iterated over
     */
    async toArray(): Promise<I[]> {
        const result: I[] = [];
        await this.consume((value) => {
            result.push(value);
        });
        return result;
    }

    /**
     * Maps the values.
     *
     * Optionally, a `errorMapper` can be provided
     * which allows to handle errors thrown by the `mapper`
     * and return a error value.
     * @see {@link map}
     */
    map<Output, ErrorOutput = never>(
        mapper: (input: I) => Output | Promise<Output>,
        errorMapper?: (
            input: I,
            error: unknown,
        ) => ErrorOutput | Promise<ErrorOutput>,
    ): Chain<Output | ErrorOutput> {
        return this.pipe(map(mapper, errorMapper));
    }

    /**
     * The same as `map`, but allowing to process values in parallel
     * @see {@link concurrentMap}
     */
    concurrentMap<Output, ErrorOutput = never>(
        options: ConcurrentMapOptions,
        mapper: (input: I) => Promise<Output> | Output,
        errorMapper?: (
            input: I,
            error: unknown,
        ) => Promise<ErrorOutput> | ErrorOutput,
    ): Chain<Output | ErrorOutput> {
        return this.pipe(concurrentMap(options, mapper, errorMapper));
    }

    /**
     * Calls a function for each item without changing items in the chain.
     * @see {@link tap}
     */
    tap(tapper: (input: I) => void | Promise<void>): Chain<I> {
        return this.pipe(tap(tapper));
    }

    /**
     * Batches items to the given size.
     *
     * The resulting chain will be a chain of arrays of the given size maximum.
     * Once the iteration is stopped, the rest of the items will be returned
     * as a batch of possibly smaller size.
     * @see {@link batch}
     */
    batch(options: number | BatchOptions): Chain<I[]> {
        return this.pipe(batch(options));
    }

    /**
     * Calculates the intervals of the items.
     *
     * Works like `batch`, but instead of returning batches of the given size,
     * it returns pairs of their first and last items.
     * @see {@link interval}
     */
    interval(size: number): Chain<[I, I]> {
        return this.pipe(interval(size));
    }

    /**
     * For the chains of arrays, returns a new chain of those arrays' items.
     * For the chains on non-arrays, does not compile.
     * @see {@link flatten}
     */
    flatten(): I extends unknown[] ? Chain<I[number]> : never {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return this.pipe(flatten);
    }

    /**
     * Filters items from the chain.
     *
     * Unlike the most of chain methods, the `filter`'s
     * predicate must be a synchronous function,
     * because it must return a type predicate.
     * @see {@link filter}
     */
    filter<Output extends I>(
        predicate: (value: I) => value is Output,
    ): Chain<Output> {
        return this.pipe<Output>(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            filter(predicate),
        );
    }

    /**
     * Passes through only the first `size` items and stops
     * iterating the source.
     *
     * @see {@link take}
     */
    take(size: number): Chain<I> {
        return this.pipe(take(size));
    }

    /**
     * Drops the first `size` items.
     *
     * @see {@link skip}
     */
    skip(size: number): Chain<I> {
        return this.pipe(skip(size));
    }

    /**
     * Accumulates items into a value and emits it when `shouldFlush` returns
     * `true`, when `timeFrame` elapses, or when the source ends.
     *
     * @see {@link bufferize}
     */
    bufferize<O>(options: BufferizeOptions<I, O>): Chain<O> {
        return this.pipe(bufferize(options));
    }

    /**
     * Called once, when the iteration is done. It is not called if the
     * consumer stops early or the source throws.
     *
     * @see {@link onEnd}
     */
    onEnd(cb: () => void): Chain<I> {
        return this.pipe(onEnd(cb));
    }
}

/**
 * Wraps an iterable in a chain, on which operators can be applied one after
 * another with methods such as `map`, `filter`, `batch` or `pipe`.
 *
 * The chain is itself an `AsyncIterable`; finish it with `toArray()` or
 * `consume()`, or iterate it with `for await`.
 *
 * @param source - any `Iter`: an array, a generator, an async generator, ...
 * @returns a chain over the source
 *
 * @example
 * ```ts
 * const result = await chain(range(1, 6))
 *     .map((n) => n * 2)
 *     .skip(1)
 *     .take(3)
 *     .toArray();
 * // => [4, 6, 8]
 * ```
 */
export function chain<T>(source: Iter<T>) {
    return new Chain(source);
}
