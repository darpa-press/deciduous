"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { parseSegment, paneIdentity, segmentsFromPathname } from "@/lib/panes";
import { ActionBar } from "@/components/ActionBar";
import { renderPane } from "@/app/pane-action";

/**
 * One pane of the stack, and the reason the stack is isolated.
 *
 * The pane owns its own segment — position `index` of the pathname — and
 * nothing else. When some other pane changes, this component re-renders but
 * its contents are the same React element as before, so React touches no DOM:
 * scroll position, media and any open lightbox all survive. Only when *this*
 * pane's segment changes does it ask the server for new contents.
 *
 * The first render comes from the page as `children`, so a cold load is fully
 * server-rendered and crawlable; only later changes go through the action.
 *
 * `data-pane` exists so tests can tell a real pane from a Suspense fallback.
 */
export function PaneHost({
    index,
    initialSegment,
    loggedIn = false,
    children,
}: {
    index: number;
    initialSegment: string;
    /** Whether the admin session is active, for the chrome's edit actions. */
    loggedIn?: boolean;
    /** Server-rendered contents for `initialSegment`. */
    children: ReactNode;
}) {
    const pathname = usePathname();
    const segments = segmentsFromPathname(pathname);
    // `/index` is served from the root path (see src/proxy.ts), so fall back
    // to what the server rendered when the pathname carries no segments.
    const segment = segments[index] ?? initialSegment;

    const [content, setContent] = useState<ReactNode>(children);
    const [failed, setFailed] = useState(false);
    const renderedFor = useRef(initialSegment);

    /**
     * Adopt server content that arrives after a mutation.
     *
     * A Server Action re-renders this route and sends fresh `children` for the
     * segment the pane started on. Holding the first `children` in state and
     * never looking again meant every updateTag in the editing actions was
     * invisible to a pane already on screen: save a piece at `/index/edit-125`
     * and the index beside it went on listing the old title until a full
     * reload. Only adopt while the pane is still showing what the server sent —
     * once it has navigated on its own, the payload is for a different segment.
     *
     * `children` keeps its identity across the re-renders `usePathname` causes,
     * so this only fires when a new payload actually arrives; on mount it sets
     * the value already in state and React bails out.
     */
    useEffect(() => {
        if (renderedFor.current !== initialSegment) return;
        setContent(children);
        setFailed(false);
    }, [children, initialSegment]);

    const scrollRef = useRef<HTMLDivElement>(null);
    // What this pane is currently showing, ignoring how. Used to decide
    // whether new content is a new thing to read or the same thing in another
    // form — see paneIdentity.
    const shownIdentity = useRef(paneIdentity(initialSegment));

    useEffect(() => {
        if (renderedFor.current === segment) return;

        let cancelled = false;
        setFailed(false);

        renderPane(segment, index).then(
            (node) => {
                if (cancelled) return;

                const nextIdentity = paneIdentity(segment);
                const isDifferentThing = nextIdentity !== shownIdentity.current;

                renderedFor.current = segment;
                shownIdentity.current = nextIdentity;
                setContent(node);

                // A different piece starts at the top. Laying the card over the
                // same piece does not move the reader.
                if (isDifferentThing && scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                }
            },
            // Navigation is pushState-only, so a tab stays open across a
            // deploy and the action id it is calling stops existing. Without
            // this the rejection went unhandled and the pane kept rendering
            // the previous segment while the URL and the chrome showed the new
            // one, with nothing to say so and no way back.
            () => {
                if (!cancelled) setFailed(true);
            }
        );

        return () => {
            cancelled = true;
        };
    }, [segment, index]);

    const pane = parseSegment(segment);
    const cardLink =
        pane.kind === "piece" ? (pane.card ? String(pane.page) : `${pane.page}c`) : undefined;
    const editTarget =
        pane.kind === "piece"
            ? `edit-${pane.page}`
            : pane.kind === "person"
              ? `edit-person-${pane.slug}`
              : undefined;

    return (
        <div className="pane" data-pane={index}>
            <div className="pane-scroll" ref={scrollRef}>
                {failed ? (
                    <div className="pane-inside">
                        <p>This pane could not be loaded.</p>
                        <p className="quiet">
                            The page has been open a while — reload to catch up.
                        </p>
                        <button type="button" onClick={() => window.location.reload()}>
                            Reload
                        </button>
                    </div>
                ) : (
                    content
                )}
            </div>
            <ActionBar index={index} cardLink={cardLink} editTarget={editTarget} loggedIn={loggedIn} />
        </div>
    );
}
