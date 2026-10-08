/**
 * Anything that can be iterated with `for await`: a synchronous `Iterable`
 * (an array, a generator, ...) or an `AsyncIterable`.
 */
export type Iter<T> = Iterable<T> | AsyncIterable<T>;
