import { chain } from "./Chain";
import { Fifo } from "./Fifo";
import type { Iter } from "./Iter";

type Iteratee<T> = T extends Iter<infer U> ? U : never;

/**
 * The iterable behind `mux`. Prefer the `mux` function.
 */
export class Mux<
    T extends Iter<unknown>,
    E extends Iteratee<T> = Iteratee<T>,
> implements AsyncIterable<E> {
    constructor(private inputs: T[]) {}

    [Symbol.asyncIterator](): AsyncIterator<E> {
        const fifo = new Fifo<E>({ highWatermark: 1 });
        let failed = false;

        const fail = (error: unknown) => {
            if (failed) {
                return;
            }
            failed = true;
            fifo.end(error);
        };

        // Once the fifo has ended, the other inputs fail on their next
        // `send`; that rejection lands in `fail`, which ignores it.
        const runs = this.inputs.map((input) =>
            chain(input)
                .tap(async (value) => {
                    await fifo.send(value as E);
                })
                .consume()
                .catch(fail),
        );

        Promise.all(runs).then(() => {
            if (!failed) {
                fifo.end();
            }
        });

        return fifo[Symbol.asyncIterator]();
    }
}

/**
 * Creates an async iterable that merges several inputs into one.
 *
 * Items are emitted as they arrive, so the order across inputs is not
 * defined; the order within each input is kept.
 *
 * @param inputs - the sources to merge
 * @returns an async iterable of the items of all inputs
 *
 * @example
 * ```ts
 * const merged = await chain(
 *     mux([
 *         [1, 2, 3],
 *         [10, 20, 30],
 *     ]),
 * ).toArray();
 * // the six items arrive in some interleaving;
 * // merged.filter((n) => n < 10) => [1, 2, 3]
 * // merged.filter((n) => n >= 10) => [10, 20, 30]
 * ```
 */
export function mux<T extends Iter<unknown>>(
    inputs: T[],
): AsyncIterable<Iteratee<T>> {
    return new Mux(inputs);
}
