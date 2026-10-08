import type { Iter } from "./Iter";

export type OperatorFunction<I, O> = (source: Iter<I>) => Iter<O>;
export type OperatorObject<I, O> = {
    process: OperatorFunction<I, O>;
};
export type Operator<I, O> = OperatorFunction<I, O> | OperatorObject<I, O>;
