"use client";

import { useEffect, useState, useTransition } from "react";

import { lookupWord, attachWord, type WordResult } from "@/app/word-actions";

/**
 * Find a word in WordNet and attach its synset to the piece.
 *
 * Attaching stores the synset and everything above it in the hypernym chain,
 * which is what gives the word index its shape. Ported from
 * Components/WordFinder.
 */
export function WordFinder({
    selected,
    onAdd,
    onRemove,
}: {
    selected: { id: string; label: string }[];
    onAdd: (word: { id: string; label: string }) => void;
    onRemove: (id: string) => void;
}) {
    const [term, setTerm] = useState("");
    const [results, setResults] = useState<WordResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    // Debounced, as the legacy DebounceInput was.
    useEffect(() => {
        const trimmed = term.trim();
        // Nothing to look up. Results for the previous term are hidden by
        // `visible` below rather than cleared here, which keeps this effect
        // free of state writes.
        if (!trimmed) return;

        const timer = setTimeout(() => {
            startTransition(async () => {
                try {
                    setError(null);
                    setResults(await lookupWord(trimmed));
                } catch {
                    setError("Could not reach WordNet.");
                    setResults([]);
                }
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [term]);

    function add(result: WordResult) {
        if (selected.some((word) => word.id === result.id)) {
            onRemove(result.id);
            return;
        }
        startTransition(async () => {
            try {
                const stored = await attachWord(term.trim(), result.id);
                onAdd({ id: result.id, label: stored?.word ?? result.word });
            } catch {
                setError("Could not attach that word.");
            }
        });
    }

    // Only show results that belong to what is currently typed.
    const visible = term.trim() ? results : [];

    return (
        <div className="word-finder">
            <input
                type="text"
                className="word-finder-search"
                placeholder="Find a word"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
            />

            {error && <div className="form-error">{error}</div>}

            {visible.length > 0 && (
                <div className="word-finder-results">
                    {visible.map((result) => {
                        const chosen = selected.some((word) => word.id === result.id);
                        return (
                            <button
                                type="button"
                                key={result.id}
                                className={`word-finder-result ${chosen ? "is-chosen" : ""}`}
                                onClick={() => add(result)}
                                disabled={pending}
                            >
                                <span className="word-finder-pos">{result.pos}</span>
                                <span>{result.gloss || result.word}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="word-chips">
                {selected.length === 0 && <span className="quiet">None</span>}
                {selected.map((word) => (
                    <button
                        type="button"
                        key={word.id}
                        className="word-chip"
                        onClick={() => onRemove(word.id)}
                        title="Remove"
                    >
                        {word.label} ×
                    </button>
                ))}
            </div>
        </div>
    );
}
