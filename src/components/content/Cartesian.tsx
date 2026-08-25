"use client";

import { useEffect, useState } from "react";

/**
 * `<cartesian contents='[["a","b"],["c","d"]]' shuffle limit="10">` renders the
 * cartesian product of its word lists. Ported from Plugins/Cartesian.
 *
 * The product is built once after mount rather than during render, because it
 * is shuffled: randomness during render is impure, would re-roll on every
 * re-render, and cannot be server-rendered without a hydration mismatch. The
 * legacy component did the same thing in componentDidMount, so the initial
 * empty frame matches the live site too.
 */
function product(sets: string[][]): string[][] {
    return sets.reduce<string[][]>((acc, set) => acc.flatMap((row) => set.map((v) => [...row, v])), [
        [],
    ]);
}

function shuffled<T>(input: T[]): T[] {
    const out = [...input];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export function Cartesian({
    contents,
    shuffle,
    limit,
}: {
    contents: string[][];
    shuffle?: boolean;
    limit?: number;
}) {
    const [rows, setRows] = useState<string[][]>([]);

    useEffect(() => {
        let out = product(contents ?? []);
        if (shuffle) out = shuffled(out);
        if (limit) out = out.slice(0, limit);
        // Deliberate: the value is random, so it cannot be produced during
        // render without either re-rolling on every re-render or mismatching
        // what the server sent. Computing it after mount is the point.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRows(out);
    }, [contents, shuffle, limit]);

    return (
        <div>
            {rows.map((row, i) => (
                <div key={i}>
                    {row.map((word, j) => (
                        <span key={`${word}-${j}`}>{word} </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
