"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * The codex's internal link. `<aa to="12,13,14">` names one *or more*
 * destinations, and the legacy parser shuffled them and took the first — so a
 * link's destination is deliberately random.
 *
 * Targets are resolved to full pane URLs on the server (see lib/content
 * render), and the random choice happens here, at click time rather than at
 * render time. Choosing on render would either hydrate mismatched or, once the
 * page is cached, freeze one destination forever; choosing on click keeps the
 * randomness and leaves a real href for no-JS and middle-click.
 */
export function AALink({
    targets,
    children,
    ...rest
}: {
    targets: string[];
    children?: ReactNode;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}) {
    const router = useRouter();
    const href = targets[0] ?? "/";

    function onClick(event: MouseEvent<HTMLAnchorElement>) {
        // Leave modified clicks to the browser.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }
        event.preventDefault();
        const pick = targets[Math.floor(Math.random() * targets.length)] ?? href;
        router.push(pick);
    }

    return (
        <a href={href} onClick={onClick} {...rest}>
            {children}
        </a>
    );
}
