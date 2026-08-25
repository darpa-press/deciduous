"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";

import { buildCreateLink } from "@/lib/panes";

/**
 * A link that targets a pane position.
 *
 * Every pane lives in a nested layout so that it survives navigation — which
 * means a pane cannot know what sits in the panes *after* it, and any href
 * baked in on the server would go stale as soon as a neighbour changed.
 *
 * So hrefs are resolved here instead, from the live pathname. This component
 * re-renders on navigation, but it is a leaf: the pane around it does not.
 * That is the whole trick — the links stay correct while the content stays
 * put.
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
    const segments = pathname.split("/").filter(Boolean);
    const href = buildCreateLink(segments, index)(target, contextual);

    return (
        <Link href={href} className={className} style={style} title={title} aria-label={ariaLabel}>
            {children}
        </Link>
    );
}
