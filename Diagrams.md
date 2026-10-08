## Filter

```ts
chain(["🐍", "🦔", "🐍", "🐍", "🦔"]).filter((i) => i === "🦔");
```

```mermaid
graph TD
    in(( )) -->|"🐍🦔🐍🐍🦔"| F["filter(i => i===🦔)"]
    F -->|"🦔🦔"| out(( ))
```

## Map

```ts
chain([1, 2, 3]).map((i) => i * 2);
```

```mermaid
graph TD
    in(( )) -->|"1 2 3"| M["map(i => i*2)"]
    M -->|"2 4 6"| out(( ))
```

## Take

```ts
chain(["🍎", "🍌", "🍇", "☕"]).take(2);
```

```mermaid
graph TD
    in(( )) -->|"🍎🍌🍇☕️"| T["take(2)"]
    T -->|"🍎🍌"| out(( ))
```

## Skip

```ts
chain(["🍎", "🍌", "🍇", "☕"]).skip(2);
```

```mermaid
graph TD
    in(( )) -->|"🍎🍌🍇☕️"| S["skip(2)"]
    S -->|"🍇☕️"| out(( ))
```

## Batch

```ts
chain(["🍎", "🍎", "🍎", "🍎", "🍎"]).batch(2);
```

```mermaid
graph TD
    in(( )) -->|"🍎🍎🍎🍎🍎"| B["batch(2)"]
    B -->|"[🍎🍎] [🍎🍎] [🍎]"| out(( ))
```

## Interval

```ts
chain(["🐦", "🦋", "🌻", "🐯", "🌍", "👋", "😁"]).interval(3);
```

```mermaid
graph TD
    in(( )) -->|"🐦🦋🌻🐯🌍👋😁"| B["interval(3)"]
    B -->|"[🐦🌻] [🐯👋] [😁😁]"| out(( ))
```

## Flatten

```ts
chain([["🍎", "🍎"], ["🍎", "🍎"], ["🍎"]]).flatten();
```

```mermaid
graph TD
    in(( )) -->|"[🍎🍎] [🍎🍎] [🍎]"| F["flatten"]
    F -->|"🍎🍎🍎🍎🍎"| out(( ))
```

## Mux

The interleaving below is only an example: the order across inputs is not defined, the order within each input is kept.

```ts
chain(
    mux([
        ["🍎", "🍎", "🍎", "🍎", "🍎"],
        ["🐦", "🐦", "🐦", "🐦", "🐦"],
    ]),
);
```

```mermaid
graph TD
    in1(( )) -->|"🍎🍎🍎🍎🍎"| M["mux"]
    in2(( )) -->|"🐦🐦🐦🐦🐦"| M
    M -->|"🍎🐦🍎🐦🍎🐦🍎🐦🍎🐦"| out(( ))
```
