"use client";

import { useState, useTransition } from "react";

import { search, type SearchHit } from "@/app/actions";
import { PieceCard } from "@/components/panes/PieceCard";
import { pushPane, isModifiedClick } from "@/lib/navigate";

/**
 * Search. The trigger is the faint ⇴ in the top-left corner; activating it
 * covers the viewport with a translucent sheet, an input line along the top,
 * and results as a grid of catalogue cards. Ported from Pages/Search.
 *
 * A result opens the piece beside the index — `/{page}/index` — which is what
 * the legacy results linked to, so you land somewhere you can navigate on
 * from rather than on a single page.
 *
 * The query runs as a server action, so there is no search endpoint to expose.
 */

/** Matches the legacy minLength: a single letter matches too much to be useful. */
const MIN_TERM = 2;

export function Search() {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [pending, startTransition] = useTransition();

    function onChange(value: string) {
        setTerm(value);
        if (value.trim().length < MIN_TERM) return;
        startTransition(async () => {
            setHits(await search(value));
        });
    }

    function close() {
        setOpen(false);
        setTerm("");
        setHits([]);
    }

    function go(page: number | undefined, event?: React.MouseEvent) {
        if (page == null) return;
        if (event && isModifiedClick(event)) return;
        event?.preventDefault();
        close();
        // The piece, with the index beside it.
        pushPane(`/${page}/index`);
    }

    if (!open) {
        return (
            <button type="button" className="search-icon" onClick={() => setOpen(true)} aria-label="Search">
                ⇴
            </button>
        );
    }

    const visible = term.trim().length >= MIN_TERM ? hits : [];

    return (
        <div
            className="search-screen"
            role="presentation"
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div className="search-input-line">
                <span className="search-sigil">⇴</span>
                <input
                    autoFocus
                    className="search-input"
                    type="search"
                    placeholder="Type to search"
                    value={term}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") close();
                        if (e.key === "Enter" && visible[0]) go(visible[0].page);
                    }}
                />
                {pending && <span className="search-searching">…</span>}
                <button type="button" className="search-dismiss" onClick={close} aria-label="Close search">
                    ×
                </button>
            </div>

            <div
                className="search-results"
                role="presentation"
                onClick={(event) => {
                    if (event.target === event.currentTarget) close();
                }}
            >
                {term.trim().length >= MIN_TERM && !pending && visible.length === 0 && (
                    <div className="quiet px-2">Nothing found.</div>
                )}
                {visible.map((hit) => (
                    <div className="search-result" key={hit.id}>
                        <a
                            href={`/${hit.page}/index`}
                            onClick={(event) => go(hit.page, event)}
                            className="search-card-link"
                        >
                            {/* The same card the codex shows at /{page}c. */}
                            <PieceCard piece={hit.card} index={0} />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
