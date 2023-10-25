import { chain } from "../Chain";
import { Iter } from "../Iter";

describe("chain.pipe", () => {
    it("calls an 'operator' function that transforms one Iter to another", async () => {
        async function* operator(input: Iter<number>): Iter<number> {
            for await (const value of input) {
                yield value * 2;
            }
        }

        const consumer = jest.fn();

        await chain([1, 2, 3]).pipe(operator).consume(consumer);

        expect(consumer.mock.calls).toEqual([[2], [4], [6]]);
    });

    it("calls a `process` method on an operator object. The `process` method can be just an operator function", async () => {
        class MyOperator {
            async *process(input: Iter<number>): Iter<number> {
                for await (const value of input) {
                    yield value * 2;
                }
            }
        }

        const consumer = jest.fn();

        await chain([1, 2, 3]).pipe(new MyOperator()).consume(consumer);

        expect(consumer.mock.calls).toEqual([[2], [4], [6]]);
    });

    it("calls a `process` method on an operator object. The `process` method can use its own chain internally", async () => {
        class MyOperator {
            process(input: Iter<number>): Iter<number> {
                return chain(input).map((value) => value * 2);
            }
        }

        const consumer = jest.fn();

        await chain([1, 2, 3]).pipe(new MyOperator()).consume(consumer);

        expect(consumer.mock.calls).toEqual([[2], [4], [6]]);
    });
});
