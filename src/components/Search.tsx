"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { search, type SearchHit } from "@/app/actions";

/**
 * The search overlay. Ported from Pages/Search — a debounced input over the
 * whole viewport, with results as a plain list.
 *
 * The query runs as a server action rather than an API request, so there is no
 * endpoint to expose and no client-side database access.
 */
export function Search() {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function onChange(value: string) {
        setTerm(value);
        startTransition(async () => {
            setHits(await search(value));
        });
    }

    function go(page?: number) {
        if (page == null) return;
        setOpen(false);
        setTerm("");
        setHits([]);
        router.push(`/${page}`);
    }

    if (!open) {
        return (
            <button type="button" className="search-icon" onClick={() => setOpen(true)} aria-label="Search">
                ⇴
            </button>
        );
    }

    return (
        <div className="search-screen">
            <button
                type="button"
                className="search-dismiss"
                onClick={() => setOpen(false)}
                aria-label="Close search"
            >
                ×
            </button>

            <div className="search-inner">
                <input
                    autoFocus
                    className="search-input"
                    value={term}
                    placeholder="⇴"
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") setOpen(false);
                        if (e.key === "Enter" && hits[0]) go(hits[0].page);
                    }}
                />

                <div className="search-results">
                    {term && !pending && hits.length === 0 && <div className="quiet">Nothing found.</div>}
                    {hits.map((hit) => (
                        <button type="button" key={hit.id} className="search-hit" onClick={() => go(hit.page)}>
                            {hit.title}
                            <span className="index-number">{hit.page}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
