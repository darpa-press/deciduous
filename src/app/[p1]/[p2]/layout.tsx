import { Suspense } from "react";

import "@/styles/content.css";
import { PaneSlot } from "@/components/panes/PaneSlot";

/** Pane 1 of the stack. See [p1]/layout.tsx for why these are layouts. */

async function Slot({ params }: { params: LayoutProps<"/[p1]/[p2]">["params"] }) {
    const { p2 } = await params;
    return <PaneSlot segment={p2} index={1} />;
}

export default function PaneLayout({ children, params }: LayoutProps<"/[p1]/[p2]">) {
    return (
        <>
            <Suspense fallback={<div className="pane" />}>
                <Slot params={params} />
            </Suspense>
            {children}
        </>
    );
}
