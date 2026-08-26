"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { paneTitle } from "@/app/title-action";
import { segmentsFromPathname } from "@/lib/panes";

/** Keeps document.title in step with the pane stack. Renders nothing. */
export function PaneTitleSync() {
    const pathname = usePathname();

    useEffect(() => {
        let cancelled = false;
        const segments = segmentsFromPathname(pathname);

        // `/index` is served from the root path, so the pathname carries no
        // segments there and paneTitle would answer with the bare fallback —
        // overwriting the correct "Index — Deciduous" that generateMetadata
        // had already set. Nothing to sync means nothing to do.
        if (!segments.length) return;

        paneTitle(segments).then((title) => {
            if (!cancelled && title) document.title = title;
        });

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    return null;
}
