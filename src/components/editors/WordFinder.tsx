"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    /**
     * Results carry the term they belong to.
     *
     * The debounce timer was cleared on each keystroke but the request it had
     * already dispatched was not, so a slow lookup could land on top of a
     * newer one: type "in", pause, finish "insect", and the insect results
     * painted and were then replaced by the ones for "in". Attaching from that
     * stale list then silently stored nothing — see `add` below.
     */
    const [found, setFound] = useState<{ term: string; items: WordResult[] }>({
        term: "",
        items: [],
    });

    /** Bumped whenever a newer lookup supersedes an older one still in flight. */
    const latest = useRef(0);

    const trimmed = term.trim();

    // Debounced, as the legacy DebounceInput was.
    useEffect(() => {
        const query = term.trim();
        if (!query) return;

        const timer = setTimeout(() => {
            const ticket = ++latest.current;
            startTransition(async () => {
                try {
                    setError(null);
                    const items = await lookupWord(query);
                    if (ticket === latest.current) setFound({ term: query, items });
                } catch {
                    if (ticket === latest.current) {
                        setError("Could not reach WordNet.");
                        setFound({ term: query, items: [] });
                    }
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
                // Attach against the term these results were found for, not
                // whatever is in the box now.
                const stored = await attachWord(found.term, result.id);
                if (!stored) {
                    // attachWord answers null when it cannot find the synset to
                    // store — WordNet timing out mid-edit is enough, since
                    // lookup swallows its own errors. Adding the chip anyway
                    // left the piece pointing at a word that was never written:
                    // the word pane 404s, the back-of-book index never lists
                    // it, and populate drops the dangling reference so the card
                    // shows nothing. Nothing said so.
                    setError("Could not attach that word. Try again.");
                    return;
                }
                onAdd({ id: result.id, label: stored.word });
            } catch {
                setError("Could not attach that word.");
            }
        });
    }

    // Only show results that belong to what is currently typed.
    const visible = trimmed && found.term === trimmed ? found.items : [];

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
