"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { buildCreateLink } from "@/lib/panes";
import { pushPane, isModifiedClick } from "@/lib/navigate";

/**
 * The codex's internal link. `<aa to="12,13,14">` names one *or more*
 * destinations and the legacy parser shuffled them, so a link's destination is
 * deliberately random.
 *
 * Both the pane arithmetic and the random choice happen here rather than on
 * the server: the pane this link sits in is a persisted layout that cannot see
 * its neighbours, and resolving at render time would either freeze one
 * destination into the cache or mismatch on hydration. Reading the live
 * pathname keeps the href correct, and rolling on click keeps it random.
 */
export function AALink({
    targets,
    index,
    children,
    ...rest
}: {
    /** Raw segment targets from the `to`/`href` attribute. */
    targets: string[];
    /** Which pane this link sits in. */
    index: number;
    children?: ReactNode;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}) {
    const pathname = usePathname();

    const segments = pathname.split("/").filter(Boolean);
    const createLink = buildCreateLink(segments, index);
    const hrefs = targets.map((t) => createLink(t, true));
    const href = hrefs[0] ?? "/";

    function onClick(event: MouseEvent<HTMLAnchorElement>) {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        pushPane(hrefs[Math.floor(Math.random() * hrefs.length)] ?? href);
    }

    return (
        <a href={href} onClick={onClick} {...rest}>
            {children}
        </a>
    );
}
