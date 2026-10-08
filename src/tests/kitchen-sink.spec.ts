import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { Fifo } from "../Fifo";
import { range } from "../Range";
import { sleep } from "./sleep";

describe("kitchen sink", () => {
    it("is an example of all the things that can be done with chain", async () => {
        // Let's create a chain that:
        // - filters only even numbers
        // - adds 1 to each number
        // - packs them into batches of 10
        // - concurrently processes the batches, calling a "remote API" that
        //   sums all the numbers in the batch
        // - reports the sums

        // Our unreliable API that fails sometimes and has a random delay
        const sumCalculator = async (batch: number[]) => {
            await sleep(100 + Math.random() * 100);

            if (Math.random() < 0.5) {
                throw new Error("something went wrong");
            }

            return batch.reduce((acc, value) => acc + value, 0);
        };

        interface ErrorResult<T> {
            kind: "error";
            error: Error;
            input: T;
        }

        // This is a intermediate queue which we will use to push back the
        // batches that we failed to process using the API.
        // We will retry them later
        const queue = new Fifo<number[]>({
            highWatermark: 3,
        });

        // Push back the task to the queue
        async function enqueueRetry(input: number[]) {
            await queue.send(input);
        }

        // Check if the result is an error
        function isError<I, O>(
            result: O | ErrorResult<I>,
        ): result is ErrorResult<I> {
            return (
                result &&
                typeof result === "object" &&
                "kind" in result &&
                result.kind === "error"
            );
        }

        // This is the first chain, that prepares the data
        // and places it into the queue.
        // By calling it without `await` we are letting it do its job
        // in the background.
        chain(range(0, 100))
            .filter((value): value is number => value % 2 === 0)
            .map((value) => value + 1)
            .batch(10)
            .tap(async (batch) => {
                await queue.send(batch);
            })
            .consume();

        // This is the main chain that reads the data from the queue,
        // processes it and, depending on the result,
        // either collects it, or places the input back to the queue
        // to be processed again
        const [res] = await chain(queue)
            .concurrentMap(
                { concurrency: 3 },
                sumCalculator,
                // Error mapper converts thrown errors into ErrorResult
                (input, error): ErrorResult<number[]> => {
                    return {
                        kind: "error",
                        error: error as Error,
                        input,
                    } as const;
                },
            )
            .tap(async (result) => {
                if (isError(result)) {
                    await enqueueRetry(result.input);
                }
            })
            .filter((result): result is number => !isError(result))
            // For this test, let's pretend we know how many results
            // are expected.
            .batch(5)
            .tap(() => {
                // After we receive 5 values, we stop the queue
                queue.end();
            })
            .toArray();

        expect(res).toContain(100);
        expect(res).toContain(300);
        expect(res).toContain(500);
        expect(res).toContain(700);
        expect(res).toContain(900);
        expect(res).toHaveLength(5);
    });
});
