import { Fifo } from "./Fifo";
import type { Iter } from "./Iter";
import type { OperatorObject } from "./Operator";

/**
 * Options of `concurrentMap`.
 */
export interface ConcurrentMapOptions {
    /** The maximum number of `mapper` calls running at the same time. */
    concurrency: number;
    /** Called when a task starts; task ids count up from 0. */
    onTaskStarted?: (taskId: number) => void;
    /** Called when a task finishes, successfully or not. */
    onTaskCompleted?: (taskId: number) => void;
}

/**
 * The operator object behind `concurrentMap`. Prefer the `concurrentMap`
 * function or the chain method.
 */
export class ConcurrentMap<
    Input,
    Output,
    ErrorOutput = never,
> implements OperatorObject<Input, Output | ErrorOutput> {
    #currentTasksRunning = 0;
    #onCapable: (() => void) | null = null;
    #onAllTasksCompleted: (() => void) | null = null;
    #taskId = 0;

    #options: ConcurrentMapOptions;
    #mapper: (input: Input) => Promise<Output> | Output;
    #errorMapper?: (
        input: Input,
        error: unknown,
    ) => Promise<ErrorOutput> | ErrorOutput;

    #checkOut(): number {
        if (this.#currentTasksRunning >= this.#options.concurrency) {
            throw new Error("Pool is empty");
        }
        this.#currentTasksRunning++;
        const id = this.#taskId++;
        this.#options.onTaskStarted?.(id);
        return id;
    }

    #checkIn(id: number) {
        if (this.#currentTasksRunning <= 0) {
            throw new Error("Pool is full");
        }
        this.#currentTasksRunning--;
        if (this.#currentTasksRunning < this.#options.concurrency) {
            this.#onCapable?.();
        }
        this.#options.onTaskCompleted?.(id);
        if (this.#currentTasksRunning === 0) {
            this.#onAllTasksCompleted?.();
        }
    }

    #onceCapable() {
        // If we already know that the pool is not full, we don't need to wait
        if (this.#currentTasksRunning < this.#options.concurrency) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.#onCapable = resolve;
        });
    }

    #onceAllTasksCompleted() {
        if (this.#currentTasksRunning == 0) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.#onAllTasksCompleted = resolve;
        });
    }

    #process(input: Iter<Input>): AsyncIterable<Output | ErrorOutput> {
        // const buffer: (Output | ErrorOutput)[] = [];

        const fifo = new Fifo<Output | ErrorOutput>();

        (async () => {
            for await (const inputItem of input) {
                // Wait for available concurrency capacity
                await this.#onceCapable();

                const id = this.#checkOut();

                Promise.resolve()
                    .then(() => this.#mapper(inputItem))
                    .catch((error) =>
                        this.#errorMapper
                            ? this.#errorMapper(inputItem, error)
                            : Promise.reject(error),
                    )
                    .then((response) => {
                        return fifo.send(response);
                    })
                    .finally(() => {
                        this.#checkIn(id);
                    });
            }

            // Wait for remaining tasks
            await this.#onceAllTasksCompleted();
            fifo.end();
        })();

        return fifo;
    }

    constructor(
        options: ConcurrentMapOptions,
        mapper: (input: Input) => Promise<Output> | Output,
        errorMapper?: (
            input: Input,
            error: unknown,
        ) => Promise<ErrorOutput> | ErrorOutput,
    ) {
        this.#mapper = mapper;
        this.#options = options;
        this.#errorMapper = errorMapper;
    }

    process = (input: Iter<Input>): AsyncIterable<Output | ErrorOutput> => {
        return this.#process(input);
    };
}

/**
 * Creates an operator like `map` that runs up to `options.concurrency`
 * `mapper` calls at the same time.
 *
 * Results are emitted in the order the calls complete, which is not
 * necessarily the order of the input.
 *
 * If `mapper` throws and an `errorMapper` is given, its return value is
 * emitted instead.
 *
 * @param options - see `ConcurrentMapOptions`
 * @param mapper - transforms an item; may be asynchronous
 * @param errorMapper - turns an error thrown by `mapper` into a value
 * @returns an operator object
 *
 * @example
 * ```ts
 * const delays = [60, 10, 30];
 * const work = async (ms: number) => {
 *     await sleep(ms);
 *     return ms;
 * };
 *
 * await chain(delays).concurrentMap({ concurrency: 3 }, work).toArray();
 * // => [10, 30, 60]
 * await chain(delays).concurrentMap({ concurrency: 1 }, work).toArray();
 * // => [60, 10, 30]
 * ```
 */
export function concurrentMap<Input, Output, ErrorOutput = never>(
    options: ConcurrentMapOptions,
    mapper: (req: Input) => Promise<Output> | Output,
    errorMapper?: (
        req: Input,
        error: unknown,
    ) => Promise<ErrorOutput> | ErrorOutput,
) {
    return new ConcurrentMap(options, mapper, errorMapper);
}
