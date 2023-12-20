# Stream data with iter-helpers

## Importing data

Our company develops a product for real estate agencies. And any real estate agency works with data. Often there is a lot of this data, sometimes a very large amount. While they are stored in the database, you don't often think about their volume. We start to realize the volumes when it is necessary to transfer the entire database from one system to another.

When we got one major client, we had to think about how to transfer records of millions of real estate properties from multiple disparate systems that this client used before us - to our CRM.

We wrote services that provide APIs for data import. Such an endpoint accepts a batch of 1000 real estate properties - and distributes them across databases, handles authorization, quotas, and rate limits.

And now, it's time to write the client. Integration engineers on the client side, of course, already rolled out their own solution based on our specifications. But we wanted to create our own client that would always comply with the latest version of our specification, be stable, and provide crash logs in the correct format. In short, we started writing a command-line utility that would take huge JSONLine files as input - and send the data to our servers.

So, the task is:

Итак, задача:

-   given a JSONLine file, each line of which represents a JSON with a real estate object. The file can contain millions of lines and weigh gigabytes. In principle, there may not be just one file, but several. The data can be split across files arbitrarily, but it doesn't change anything.
-   given a GraphQL API that accepts, roughly, up to 1000 real estate objects in one request - and responds with a list of IDs of successfully and unsuccessfully imported objects
-   it is necessary to read the data as a stream, pack it into batches of 1000 objects, and send it to the server, handling errors and occasional rate limiter responses

## Streams

Node.js from its earliest versions introduces us to the concept of streams. Initially, they were streams of purely binary or text data, which allowed us to work with buffers or strings. Then, in some version, they added object mode, which allowed us to work with objects.

Using streams can be convenient when reading large files piece by piece instead of loading them entirely into memory.

Let's start

```ts
import { parse as parseJsonLines } from "jsonlines";

const propertiesStream = createReadStream(fileName, {
    encoding: "utf-8",
    autoClose: true,
}).pipe(parseJsonLines());
```

And now, we have a stream of real estate objects called `propertiesStream`.

We will build a chain of operations that will eventually send the data to our server.

The next step in this pipeline is to group the streams into batches of 1000.

But how can we do that? Here, we need to mention that we can continue working in the stream paradigm by writing some transform stream, to which we can pass the stream of real estate objects using the `pipe` method, and it will output batches.

Something like this:

```ts
import { Transform } from "stream";

// ...

const chunk = (size: number) => {
    const batch: any[] = [];

    return new Transform({
        objectMode: true,
        transform: (chunk, encoding, callback) => {
            batch.push(chunk);

            if (batch.length >= size) {
                callback(null, batch);
                batch.length = 0; // Clear the batch
            } else {
                callback(); // Continue processing
            }
        },
        flush: (callback) => {
            if (batch.length > 0) {
                callback(null, batch);
            } else {
                callback();
            }
        },
    });
};

const propertiesBatchStream = propertiesStream.pipe(chunk(1000));
```

But I didn't like the fact that the `Transform` doesn't check types at compile time. If it were a generic that enforces type matching between the input stream and the types passed to the transform function, and infers the type of the result... But the standard library doesn't support that.

So, let's resort to asynchronous iterators.

## Iterators

Any Node.js stream implements the `AsyncIterable` interface. This means that we can read it using `for await...of`. So instead of using a Transform stream, I should use an iterator:

```ts
import { parse as parseJsonLines } from "jsonlines";

const propertiesStream = createReadStream(fileName, {
    encoding: "utf-8",
    autoClose: true,
}).pipe(parseJsonLines());

async function* getPropertiesBatches(
    propertiesStream: AsyncIterable<Property>,
) {
    const batch: any[] = [];
    for await (const property of propertiesStream) {
        batch.push(property);
        if (batch.length >= 1000) {
            yield batch;
            batch.length = 0;
        }
    }
    if (batch.length > 0) {
        yield batch;
    }
}
```

Now we have a function that, when iterated over, allows us to work with batches of properties instead of individual properties:

```ts
// ...

for await (const batch of getPropertiesBatches(propertiesStream)) {
    // do something with batch. For, example, send it to the server
}
```

Great! I don't know about you, but I find the syntax of asynchronous iterators to be more concise and straightforward than using a Transform stream.

Additionally, we have type checking out of the box. `getPropertiesBatches()` returns a stream of batches of property objects. In our case, it is `AsyncIterable<Property[]>`, and TypeScript automatically infers this type.

However, besides properties, we will have many different entities that we would like to process in a similar way. This means that we need to make the "batch maker" a reusable function. For example, we can do it like this:

```ts
async function* makeBatch<T>(
    source: AsyncIterable<T>,
    batchSize: number,
): AsyncIterable<T[]> {
    const batch: T[] = [];
    for await (const item of source) {
        batch.push(item);
        if (batch.length >= batchSize) {
            yield batch;
            batch.length = 0;
        }
    }
    if (batch.length > 0) {
        yield batch;
    }
}
```

Now, thanks to the generic type T, the function can batch iterators of any entity. But only asynchronous iterators. However, we would like to make it more universal and allow it to handle synchronous iterators as well. For example, arrays.

```ts
// The followong code will not compile:
const b = await makeBatch([1, 2, 3, 4, 5], 2);
console.log(b);
// [[1, 2], [3, 4], [5]]
```

The code will not compile because an array does not implement the `AsyncIterable` interface. But we can make it do so and allow synchronous iterators to be processed. Let's introduce the `Iter` type, which doesn't care if it's synchronous or asynchronous:

```ts
type Iter<T> = Iterable<T> | AsyncIterable<T>;
```

And now the signature of the `makeBatch()` function will be:

```ts
async function* makeBatch<T>(
    source: Iter<T>,
    batchSize: number,
): AsyncIterable<T[]>;
```

The implementation of the function remains unchanged.

Great! We have our first helper function `makeBatch`. And we have a generic type `Iter<T>` for any iterator.

Now we need to learn how to send data to the server, passing it through the SDK, and handle the server responses by passing them further down the pipeline using an asynchronous iterator.
In other words, we need to transform data of type `Property[]` into `PropertyBatchAPICallResult`. Let's imagine that `PropertyBatchAPICallResult` is our data type that contains comprehensive information about one API call: identifiers of successfully and unsuccessfully imported objects, possible rate limiter responses, any errors (authorization, network, etc). In our chain, we won't be using exceptions, but instead, we'll wrap any errors into a data type that we'll use later.

In general, it's clear that we need to write a wrapper around the API method that would accept `Property[]`, send it to the server, and return `PropertyBatchAPICallResult`. And through this function, we should pass each element of the iterator. But this is exactly like `map`! You can call `map` on an array, but there is no such method for an asynchronous iterator. Let's write it.

```ts
function* map<T, U>(source: Iter<T>, mapper: (item: T) => Promise<U> | U) {
    for await (const item of source) {
        yield await mapper(item);
    }
}
```

Now that we have the `map`, we can write it like this:

```ts
const propertiesStream = createReadStream(fileName, {
    encoding: "utf-8",
    autoClose: true,
}).pipe(parseJsonLines());

const batchesIter = getPropertiesBatches(propertiesStream);

const serverResponsesIter = map(
    batchesIter,
    async (batch: Property[]): Promise<PropertyBatchAPICallResult> => {
        try {
            const response = await SDK.importPropertiesBatch(batch);
            return processResponse(response);
        } catch (e) {
            return processError(e);
        }
    },
);

// And now let's write logs:

for await (const response of serverResponsesIter) {
    logger.write(response);
}
```

For simplicity, I'm not showing the handling of rate limiter responses here.

So, this is basically the entire pipeline. Just a reminder, the data is processed in a chain, which means the entire JSON is not read into memory. It is read line by line, lines are grouped into batches, and the batches are sent to the server. Until the server responds to the first batch, the 1001st line of the JSON will not be read. The processing pipeline will wait. This effect is similar to backpressure. And it's great because it guarantees that memory will never grow unlimited and unpredictable.

## Pipeline (`chain`)

But I'm not very happy with how the code looks.

I would like to be able to manipulate asynchronous iterators as beautifully as arrays.

```js
const result = [1, 2, 3, 4].map(/*...*/).filter(/*...*/).reduce(/*...*/);
```

It's time to rewrite our helpers so that we can write something like this:

```ts
const stream = createReadStream(fileName, {
    encoding: "utf-8",
    autoClose: true,
}).pipe(parseJsonLines());

chain(stream).batch(1000).map(importPropertiesBatch).map(writeLogs);
```

We need to implement method chaining.

But first, let's rewrite our example like this:

```ts
// (stream reader is not shown here)

await chain(stream)
    .pipe(batch(1000))
    .pipe(map(importPropertiesBatch))
    .pipe(map(writeLogs))
    .consume();
```

As you can see from the example, we need to write a class with two methods: `pipe` and `consume`.

The `pipe` method allows us to transform an iterator through a function.

The `consume` method actually iterates over the iterator.

```ts
class Chain<T> {
    constructor(private source: Iter<T>) {}
    pipe<O>(op: Operator<T, O>): Chain<O> {
        return new Chain<O>(op(this.source));
    }
    async consume(): Promise<void> {
        for await (const value of this.source) {
        }
    }
}
```

We have a new term in our vocabulary: `Operator`. It's just a function that takes an iterator of one type and returns a new iterator of another type:

```ts
interface Operator<I, O> {
    (input: Iter<I>): Iter<O>;
}
```

And now that we have such primitives as a pipeline and an operator, and when we can say that a pipeline is a composition of sequentially applied operator functions, we can fantasize further and come up with a bunch of other useful operators:

-   We already have:
    -   `batch` - collects iterator elements in batches
    -   `map` - applies a function to each iterator element
-   Why not add:
    -   `tap` - calls a function for each iterator element, but doesn't modify the iterator
    -   `concurrentMap` - applies a function to each iterator element with a customizable level of parallelism
    -   `filter` - filters elements
    -   `take` - selects the first N elements
    -   `skip` - skips the first N elements
    -   and so on.

This is how the idea of writing a separate library `@sweepbright/iter-helpers` came about. Everything mentioned above and much more is already implemented there.

[Try it, you'll like it!](https://github.com/sweepbright/iter-helpers)

## Fifo

However, in real life, things are always a bit more complicated.

Each real estate object that we import through our API has images - interior photos, layout drawings, etc. They also need to be imported, but through a different API. And if real estate objects are imported in batches, then images are imported one by one. Let's assume that we have a batch of 1000 real estate objects. And each property can have around 20 images. So we need to make one request to import the data - and 20,000 requests to import the images.

We could go straightforward and do something like this:

```ts
await chain(stream)
    .pipe(batch(1000))
    .pipe(map(importPropertiesBatch))
    .pipe(tap(writeLogs))
    // finds image files for each property and returns them one by one
    .pipe(map(getPropertiesImages)) // -> Iter<PropertyImage>
    .pipe(map(importPropertyImage))
    // etc
    .consume();
```

But then we would waste precious time waiting for the backpressure from `.pipe(map(importPropertyImage))` before we can send the next batch of data to the server (`.pipe(map(importPropertiesBatch))`).

Such tight synchronization is inconvenient because the image service may have its own separate rate-limiter. Moreover, its performance may vary at different times, and we would like the two processes - data import and image import - to have no mutual influence.

It would be great if we could branch off from the data import pipeline and create a separate image import pipeline. So that we could direct an iterator with property IDs to the input of the image import pipeline, and it would read and import image files at its own pace.

But there is one problem. Iterators have pull semantics. You can't just `.push()` to an iterator like you would to an array.

Long story short, I implemented an asynchronous iterator in the `@sweepbright/iter-helpers` library, to which you can `.push()`. Essentially, it's a FIFO queue that you can iterate over. I won't show the code here, it's quite convoluted, but here's how you can use it:

```ts
const f = new Fifo<number>();

chain(f).pipe(tap(console.log)).consume();

f.push(1);
f.push(2);
f.push(3);
// ...
f.end(); //<- iteration ends
```

"But where is the backpressure?" you might ask. Indeed, if in the previous example I would endlessly push numbers into `f` faster than they were processed, the queue in `f` would grow infinitely. To prevent this, you can introduce a limit on the queue size. But then, before each push, we need to make sure that the queue is not overflowing.

```ts
const f = new Fifo<number>({
    highWatermark: 100,
});

chain(f).pipe(tap(console.log)).consume();

await f.waitDrain();
f.push(1);

await f.waitDrain();
f.push(2);

await f.waitDrain();
f.push(3);
// ...
f.end(); //<- iteration ends
```

`waitDrain` returns a promise that waits until the queue size drops below the "watermark", i.e., the limit.

Armed with `Fifo`, we can rewrite our importer so that we have two independent pipelines - one for data and another for images.

```ts
const dataImportPipeline = chain(stream)
    .pipe(batch(1000))
    .pipe(map(importPropertiesBatch))
    .pipe(tap(writeLogs))
    .pipe(
        tap((batchImportResult) => {
            const ids = getSuccessfullyImportedPropertyIDs(batchImportResult);
            for (const id of ids) {
                await propertyIDsFifo.waitDrain();
                propertyIDsFifo.push(data.id);
            }
        }),
    )
    .consume();

// This is our FIFO queue, which connects the two pipelines
const propertyIDsFifo = new Fifo<string>({
    highWatermark: 10000, // let's assume we can keep 10k property IDs in the memory
});

const imageImportPipeline = chain(propertyIDsFifo)
    .pipe(map(getPropertyImages))
    .pipe(map(importPropertyImage))
    .pipe(tap(writeLogs))
    .pipe(
        // onEnd operator's callback will be called once the pipeline is done
        onEnd(() => {
            // we must end the fifo queue, otherwise the iteration will hang forever
            propertyIDsFifo.end();
        }),
    );

// Starting both pipelines in parallel
await Promise.all([
    dataImportPipeline.consume(),
    imageImportPipeline.consume(),
]);

console.log("import done");
```

Here, the back pressure from `imageImportPipeline` to `dataImportPipeline` will only occur if more than 10,000 property identifiers accumulate in the queue. In other words, the queue allows connecting the output of one pipeline to the input of another, while also configuring the buffering level, which allows, if necessary, mitigating the temporal dependencies between the execution of the two pipelines.

## Writing UI. Multiplexing Logs with `mux`

In a real project, we have a few more different data import pipelines. And they all generate metrics and logs that we would like to display in the UI.

Let's take a simplified example without metrics. Each data import pipeline pushes logs into a separate queue. And now we need to read logs from all three queues and display them in the interface:

```ts
async function displayLogs(
    contactLogs: Fifo<LogItem>,
    propertyLogs: Fifo<LogItem>,
    propertyImageLogs: Fifo<LogItem>,
) {
    await Promise.all([
        chain(contactLogs).pipe(tap(console.log)).consume(),
        chain(propertyLogs).pipe(tap(console.log)).consume(),
        chain(propertyImageLogs).pipe(tap(console.log)).consume(),
    ]);
}
```

Well, you can do it like this. We create three pipelines, and each writes something to the console. But what if we want to write not only to the console but also to a file? To the same file! But the records can come simultaneously, and that's not very good. We don't serialize potentially parallel operations!

And from the point of view of code beauty, the approach shown above also loses. What if we had to attach multiple identical handler chains for each log pipeline?

It would be great if we could combine or _multiplex_ multiple iterators into one!

For this purpose, the library provides the `mux` function.

```ts
async function displayLogs(
    contactLogs: Fifo<LogItem>,
    propertyLogs: Fifo<LogItem>,
    propertyImageLogs: Fifo<LogItem>,
) {
    await chain(mux([contactLogs, propertyLogs, propertyImageLogs]))
        .pipe(tap(console.log))
        .consume();
}
```

## End

In conclusion, I would like to note that the library is already being used in two of our projects, which have long-running processes that handle large data sets. Therefore, bugs are periodically fixed, and the library is actively being developed.

Many examples shown in the article can be simplified because the `Chain` class has not only the `pipe` method, but also shortcuts for all library operators. So instead of:

```ts
chain(/*...*/).pipe(map(/*...*/));
```

you can write:

```ts
chain(/*...*/).map(/*...*/);
```

and so on.

### P.S.

Of course, I am aware of [Async Iterator Helpers](https://github.com/tc39/proposal-async-iterator-helpers).

It is in many ways similar to my library, but `@sweepbright/iter-helpers` provides more capabilities, while at the same time it is unlikely to be compatible with the future "Async Iterator Helpers" specification.

## Links

-   [@sweepbright/iter-helpers](https://github.com/sweepbright/iter-helpers)
