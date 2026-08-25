"use client";

import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties, MouseEvent } from "react";

import { buildCreateLink } from "@/lib/panes";
import { pushPane, isModifiedClick } from "@/lib/navigate";

/**
 * A link that targets a pane position.
 *
 * The href is resolved from the live pathname, and the click updates history
 * directly rather than going through the router, so panes that did not change
 * are left alone. The real href stays on the anchor, so middle-click, copy and
 * no-JS all behave.
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

    function onClick(event: MouseEvent<HTMLAnchorElement>) {
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
