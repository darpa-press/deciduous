"use client";

import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties, MouseEvent } from "react";

import { buildCreateLink, segmentsFromPathname } from "@/lib/panes";
import { pushPane, isModifiedClick, isOtherPaneClick } from "@/lib/navigate";

/**
 * A link that targets a pane position.
 *
 * The href is resolved from the live pathname, and the click updates history
 * directly rather than going through the router, so panes that did not change
 * are left alone. The real href stays on the anchor, so middle-click, copy and
 * no-JS all behave.
 *
 * Option-click sends the link to the *other* pane — it inverts `contextual`,
 * so an index entry, which normally writes over the index itself, opens beside
 * it instead, on the right from the left-hand pane and on the left from the
 * right-hand one. In a one-pane stack the two are the same position and the
 * gesture does nothing.
 */
export function PaneLink({
    target,
    index,
    contextual = false,
    children,
    className,
    style,
    title,
    "aria-label": ariaLabel,
}: {
    /** Segment to place, e.g. "125", "index", "p-someone". */
    target: string;
    /** Which pane this link belongs to. */
    index: number;
    /**
     * Contextual links replace the pane *next door* rather than their own —
     * the rule that makes the codex read as facing pages. Content links are
     * contextual; chrome and index links are not.
     */
    contextual?: boolean;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    title?: string;
    "aria-label"?: string;
}) {
    const pathname = usePathname();
    const segments = segmentsFromPathname(pathname);
    const createLink = buildCreateLink(segments, index);
    const href = createLink(target, contextual);
    /** Where Option-click sends it: the pane a plain click would have left alone. */
    const otherHref = createLink(target, !contextual);

    function onClick(event: MouseEvent<HTMLAnchorElement>) {
        // Before isModifiedClick, which counts Alt among the modifiers it hands
        // to the browser.
        if (isOtherPaneClick(event)) {
            event.preventDefault();
            pushPane(otherHref);
            return;
        }
        if (isModifiedClick(event)) return;
        event.preventDefault();
        pushPane(href);
    }

    return (
        <a
            href={href}
            onClick={onClick}
            className={className}
            style={style}
            title={title}
            aria-label={ariaLabel}
        >
            {children}
        </a>
    );
}
