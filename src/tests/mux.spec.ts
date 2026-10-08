import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { mux } from "../Mux";
import { range } from "../Range";
import { sleep } from "./sleep";

const numbers = () => chain(range(0, 3));
const letters = () =>
    chain(range(0, 3)).map((value) =>
        String.fromCodePoint("a".codePointAt(0)! + value),
    );

describe("mux", () => {
    it("multiplexes multiple inputs into one", async () => {
        const lettersAndNumbers = await chain(
            mux([numbers(), letters()]),
        ).toArray();

        // expect the result to contain all the inputs mixed, regardless of order

        expect(new Set(lettersAndNumbers)).toEqual(
            new Set(["a", "b", "c", 0, 1, 2]),
        );
        expect(lettersAndNumbers.length).toEqual(6);
    });

    it("multiplexes multiple inputs with random time delays into one", async () => {
        const randomlyDelayedNumbers = numbers().tap(async () => {
            await sleep(Math.random() * 20);
        });
        const randomlyDelayedLetters = letters().tap(async () => {
            await sleep(Math.random() * 20);
        });

        const lettersAndNumbers = await chain(
            mux([randomlyDelayedNumbers, randomlyDelayedLetters]),
        ).toArray();

        // expect the result to contain all the inputs mixed, regardless of order

        expect(new Set(lettersAndNumbers)).toEqual(
            new Set(["a", "b", "c", 0, 1, 2]),
        );
        expect(lettersAndNumbers.length).toEqual(6);
    });
});
