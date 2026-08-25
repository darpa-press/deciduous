"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { search, type SearchHit } from "@/app/actions";

/**
 * Search. The trigger is the faint ⇴ in the top-left corner; activating it
 * covers the viewport with a translucent white sheet, an input line along the
 * top, and results as a grid of cards. Ported from Pages/Search.
 *
 * The query runs as a server action rather than an API request, so there is no
 * search endpoint to expose.
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

    function close() {
        setOpen(false);
        setTerm("");
        setHits([]);
    }

    function go(page?: number) {
        if (page == null) return;
        close();
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
            <div className="search-input-line">
                <input
                    autoFocus
                    className="search-input"
                    value={term}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") close();
                        if (e.key === "Enter" && hits[0]) go(hits[0].page);
                    }}
                />
                <button type="button" className="search-dismiss" onClick={close} aria-label="Close search">
                    ×
                </button>
            </div>

            <div className="search-results">
                {term && !pending && hits.length === 0 && (
                    <div className="quiet px-2">Nothing found.</div>
                )}
                {hits.map((hit) => (
                    <div className="search-result" key={hit.id}>
                        <button type="button" className="search-card" onClick={() => go(hit.page)}>
                            <div>
                                <span className="search-card-title">{hit.title}</span>
                            </div>
                            <div className="search-card-meta">
                                <span>{hit.page}</span>
                            </div>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
