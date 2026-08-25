"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { parseSegment, paneIdentity } from "@/lib/panes";
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
    const segments = pathname.split("/").filter(Boolean);
    // `/index` is served from the root path (see src/proxy.ts), so fall back
    // to what the server rendered when the pathname carries no segments.
    const segment = segments[index] ?? initialSegment;

    const [content, setContent] = useState<ReactNode>(children);
    const renderedFor = useRef(initialSegment);

    const scrollRef = useRef<HTMLDivElement>(null);
    // What this pane is currently showing, ignoring how. Used to decide
    // whether new content is a new thing to read or the same thing in another
    // form — see paneIdentity.
    const shownIdentity = useRef(paneIdentity(initialSegment));

    useEffect(() => {
        if (renderedFor.current === segment) return;

        let cancelled = false;
        renderPane(segment, index).then((node) => {
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
        });

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
                {content}
            </div>
            <ActionBar index={index} cardLink={cardLink} editTarget={editTarget} loggedIn={loggedIn} />
        </div>
    );
}
