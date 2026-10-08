# Errors

The first error ends the iteration: the consumer receives the items that were already emitted, then the error is thrown from `for await` or `toArray()`.

```ts
async function* failing() {
    yield 1;
    yield 2;
    throw new Error("source failed");
}

try {
    for await (const batch of chain(failing()).batch(5)) {
        console.log(batch);
    }
} catch (error) {
    console.log((error as Error).message);
}
// [ 1, 2 ]
// source failed
```

- `map`: an error thrown by the mapper is rethrown unless an error mapper turns it into a value.
- `batch`, `interval`, `bufferize`: the items accumulated at the moment of the failure are emitted first, as a last, smaller value.
- `concurrentMap`: after an error no new calls start, and the results of calls that are still running are discarded. Like `map`, it rethrows a mapper error unless an error mapper is given.
- `mux`: the first failing input ends the iteration; the other inputs stop at their next item. An input that is blocked while sending at that moment may stay blocked, because a blocked `send` is not woken up when the queue ends; it holds no CPU and raises no error.
