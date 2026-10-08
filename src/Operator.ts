import type { Iter } from "./Iter";

/**
 * An operator in its function form: takes a source `Iter` and returns a new
 * `Iter`. Operators are applied with `chain(...).pipe(operator)`.
 */
export type OperatorFunction<I, O> = (source: Iter<I>) => Iter<O>;
/**
 * An operator in its object form: an object whose `process` method is an
 * `OperatorFunction`. Useful for operators that carry state or options.
 */
export type OperatorObject<I, O> = {
    process: OperatorFunction<I, O>;
};
/**
 * Either form of an operator: an `OperatorFunction` or an `OperatorObject`.
 */
export type Operator<I, O> = OperatorFunction<I, O> | OperatorObject<I, O>;
