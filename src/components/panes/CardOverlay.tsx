"use client";

import type { ReactNode, MouseEvent } from "react";
import { usePathname } from "next/navigation";

import { buildCreateLink } from "@/lib/panes";
import { pushPane } from "@/lib/navigate";

/**
 * The sheet the catalogue card sits on. Clicking the sheet — but not the card
 * itself — puts the card away and returns to the piece, which is how the
 * legacy overlay behaved.
 */
export function CardOverlay({
    index,
    page,
    children,
}: {
    index: number;
    /** The piece behind the card, so dismissing can return to it. */
    page: number;
    children: ReactNode;
}) {
    const pathname = usePathname();

    function onClick(event: MouseEvent<HTMLDivElement>) {
        // Only a click on the sheet itself dismisses.
        if (event.target !== event.currentTarget) return;
        const segments = pathname.split("/").filter(Boolean);
        pushPane(buildCreateLink(segments, index)(String(page), false));
    }

    return (
        <div className="card-overlay" onClick={onClick} role="presentation">
            <div className="card-bounce">{children}</div>
        </div>
    );
}
