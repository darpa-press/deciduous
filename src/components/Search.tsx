"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

import { search, type SearchHit } from "@/app/actions";
import { PieceCard } from "@/components/panes/PieceCard";
import { pushPane, isModifiedClick } from "@/lib/navigate";
import { panePath, segmentsFromPathname } from "@/lib/panes";

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
/** Long enough for any phrase worth searching; see the cap in app/actions.ts. */
const MAX_TERM = 128;
const DEBOUNCE_MS = 250;

export function Search() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");
    const [pending, startTransition] = useTransition();

    /**
     * Results carry the term they belong to.
     *
     * There was no debounce and no sequencing: every keystroke fired its own
     * action and whichever resolved last won, so a slow early prefix could
     * land after — and overwrite — the results for what had actually been
     * typed. Keeping the term alongside the hits settles both that and the
     * staleness in the other direction, where deleting back below the minimum
     * left the previous term's results on screen.
     */
    const [found, setFound] = useState<{ term: string; items: SearchHit[] }>({
        term: "",
        items: [],
    });

    /** Bumped whenever a newer query supersedes an older one still in flight. */
    const latest = useRef(0);

    const trimmed = term.trim();

    useEffect(() => {
        const query = term.trim();
        if (query.length < MIN_TERM) return;

        const timer = setTimeout(() => {
            const ticket = ++latest.current;
            startTransition(async () => {
                const items = await search(query);
                if (ticket === latest.current) setFound({ term: query, items });
            });
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [term]);

    function close() {
        latest.current++;
        setOpen(false);
        setTerm("");
        setFound({ term: "", items: [] });
    }

    /**
     * The piece, with the index beside it — in the stack that is actually on
     * screen. Pushing a fixed `/{page}/index` changed the URL's pane count
     * without changing the mounted panes, so a third pane stayed visible while
     * the URL denied it existed, and its links then computed against the wrong
     * stack length.
     */
    function hrefFor(page: number | undefined): string {
        const stack = segmentsFromPathname(pathname);
        const next = stack.length ? stack.slice(0) : [String(page)];
        next[0] = String(page);
        if (next.length > 1) next[1] = "index";
        return panePath(next);
    }

    function go(page: number | undefined, event?: React.MouseEvent) {
        if (page == null) return;
        if (event && isModifiedClick(event)) return;
        event?.preventDefault();
        const href = hrefFor(page);
        close();
        pushPane(href);
    }

    if (!open) {
        return (
            <button type="button" className="search-icon" onClick={() => setOpen(true)} aria-label="Search">
                ⇴
            </button>
        );
    }

    // Only results that belong to what is currently typed.
    const settled = trimmed.length >= MIN_TERM && found.term === trimmed;
    const visible = settled ? found.items : [];

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
                    maxLength={MAX_TERM}
                    onChange={(e) => setTerm(e.target.value.slice(0, MAX_TERM))}
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
                {settled && !pending && visible.length === 0 && (
                    <div className="quiet px-2">Nothing found.</div>
                )}
                {visible.map((hit) => (
                    <div className="search-result" key={hit.id}>
                        <a
                            href={hrefFor(hit.page)}
                            onClick={(event) => go(hit.page, event)}
                            className="search-card-link"
                        >
                            {/* The same card the codex shows at /{page}c, but
                                with its own links suppressed — the whole card
                                is this anchor. */}
                            <PieceCard piece={hit.card} index={0} linked={false} />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
