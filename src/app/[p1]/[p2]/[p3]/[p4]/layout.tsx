import { Suspense } from "react";

import "@/styles/content.css";
import { PaneSlot } from "@/components/panes/PaneSlot";

/** Pane 3 of the stack. See [p1]/layout.tsx for why these are layouts. */

async function Slot({ params }: { params: LayoutProps<"/[p1]/[p2]/[p3]/[p4]">["params"] }) {
    const { p4 } = await params;
    return <PaneSlot segment={p4} index={3} />;
}

export default function PaneLayout({ children, params }: LayoutProps<"/[p1]/[p2]/[p3]/[p4]">) {
    return (
        <>
            <Suspense fallback={<div className="pane" />}>
                <Slot params={params} />
            </Suspense>
            {children}
        </>
    );
}
