"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { paneTitle } from "@/app/title-action";

/** Keeps document.title in step with the pane stack. Renders nothing. */
export function PaneTitleSync() {
    const pathname = usePathname();

    useEffect(() => {
        let cancelled = false;
        const segments = pathname.split("/").filter(Boolean);

        paneTitle(segments).then((title) => {
            if (!cancelled && title) document.title = title;
        });

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    return null;
}
