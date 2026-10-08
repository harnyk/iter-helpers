/* eslint-disable indent */
import { Fifo } from "./Fifo";
import { Iter } from "./Iter";
import { OperatorObject } from "./Operator";

export interface ConcurrentMapOptions {
    concurrency: number;
    onTaskStarted?: (taskId: number) => void;
    onTaskCompleted?: (taskId: number) => void;
}

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
                        fifo.push(response);
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
