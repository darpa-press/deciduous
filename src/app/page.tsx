import { Suspense } from "react";
import { headers } from "next/headers";

import "@/styles/content.css";
import { PaneSlot } from "@/components/panes/PaneSlot";
import { paneMetadata } from "@/lib/pane-metadata";
import { PANE_HEADER } from "@/proxy";

/**
 * Serves `/index`, which Next collapses to `/` before routing. The proxy
 * redirects a genuine `/` away before it gets here, and marks `/index` with a
 * header so this page knows to render that pane — see src/proxy.ts.
 */

async function Root() {
    const pane = (await headers()).get(PANE_HEADER) ?? "index";

    return (
        <div className="pane-container">
            <PaneSlot segment={pane} index={0} />
        </div>
    );
}

export async function generateMetadata() {
    const pane = (await headers()).get(PANE_HEADER);
    return paneMetadata(pane ? [pane] : []);
}

export default function Home() {
    return (
        <Suspense fallback={<div className="pane-container" />}>
            <Root />
        </Suspense>
    );
}
