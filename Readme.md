[![CI](https://github.com/harnyk/iter-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/harnyk/iter-helpers/actions/workflows/ci.yml)

> Requires Node.js 22 or newer.

# Iter Helpers

This project provides a collection of helper functions for working with asyncronous iterators in TypeScript.

## Installation

To install the package, run the following command:

```
pnpm add @harnyk/iter-helpers
```

## Usage

The `chain` function is used to create a new instance of the `Chain` class. The `Chain` class represents a chain of iterable objects, allowing for easy composition and manipulation of iterators.

Overall, `chain` provides a convenient way to work with iterable objects and perform operations on them in a chained manner.

## Glossary

- `Iter` - a convenient interface defining both synchronous and asynchronous iterator
- operator - a function that takes an iterator and returns a new iterator
- piping - composition of operators

## API

See the [Diagrams](./Diagrams.md) for a visual representation of the API.

### Chain

- `chain(iter)` - creates a new instance of the `Chain` class
- `.pipe(operator)` - transform an iterator using an operator
- `.map(mapFn, errorMapFn)` - applies a function to each element of an iterator
- `.concurrentMap(options, mapFn, errorMapFn)` - applies a function to each element of an iterator concurrently
- `.filter(fn)` - filters elements of an iterator based on a predicate
- `.take(n)` - returns the first n elements of an iterator
- `.skip(n)` - returns the last n elements of an iterator
- `.batch(n)` - splits an iterator into batches of size `n`
- `.interval(n)` - splits an iterator into intervals (tuples containing a pair of start and end items) of size `n`
- `.flatten()` - flattens an iterator of arrays into an iterator of elements
- `.toArray()` - converts an iterator to an array

### Fifo

- `new Fifo(options)` - creates a FIFO queue

### Range

- `range(start, end?, step?)` - creates an iterator of numbers

### Mux

- `mux(iterators)` - multiplexes multiple iterators into one
