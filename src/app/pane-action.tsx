"use server";

import { Suspense, type ReactNode } from "react";

import { PaneBody } from "@/components/panes/PaneBody";

/**
 * Renders one pane on the server, on demand.
 *
 * This is what makes panes independent. Route-driven navigation always
 * re-renders the matched route, so some other pane is always rebuilt: a flat
 * route rebuilds all of them, and nested layouts rebuild everything to the
 * right of whichever segment changed. Neither suits a codex where clicking in
 * the right-hand pane opens something in the left and the right-hand pane must
 * stay exactly where it is.
 *
 * So a pane change bypasses routing — the URL moves via history.pushState —
 * and only the pane that actually changed asks for new contents here. The
 * content is still rendered on the server; only the request for it moves.
 */
export async function renderPane(segment: string, index: number): Promise<ReactNode> {
    return (
        <Suspense fallback={<div className="piece-title">⋅</div>}>
            <PaneBody segment={segment} index={index} />
        </Suspense>
    );
}
