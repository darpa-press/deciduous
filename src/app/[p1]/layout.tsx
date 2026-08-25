import { Suspense } from "react";

import "@/styles/content.css";
import { PaneSlot } from "@/components/panes/PaneSlot";

/**
 * The first pane, and the flex container the rest of the stack sits in.
 *
 * Panes are nested layouts on purpose. A layout does not re-render when its
 * own segment is unchanged, so navigating /2/125 -> /2/index leaves this pane
 * mounted: no refetch, no remount, and its scroll position survives. A single
 * catch-all route cannot do that — it rebuilds the whole stack on every
 * navigation.
 *
 * `params` is read inside the Suspense boundary because Cache Components
 * treats it as runtime data: reading it in the layout body would block the
 * route from prerendering at all.
 */

async function Slot({ params }: { params: LayoutProps<"/[p1]">["params"] }) {
    const { p1 } = await params;
    return <PaneSlot segment={p1} index={0} />;
}

export default function PaneLayout({ children, params }: LayoutProps<"/[p1]">) {
    return (
        <div className="pane-container">
            <Suspense fallback={<div className="pane" />}>
                <Slot params={params} />
            </Suspense>
            {children}
        </div>
    );
}
