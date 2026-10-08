import type { Iter } from "./Iter";

export async function* flatten<T>(input: Iter<T[]>): Iter<T> {
    for await (const items of input) {
        for (const item of items) {
            yield item;
        }
    }
}
