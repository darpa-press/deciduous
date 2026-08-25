"use server";

import { paneMetadata } from "@/lib/pane-metadata";

/**
 * The document title for a pane stack.
 *
 * Pane changes move the URL with history.pushState rather than navigating, so
 * generateMetadata does not re-run and the title would otherwise stay on
 * whatever the page first loaded with. The legacy app updated the title from
 * the client too, for the same reason.
 */
export async function paneTitle(segments: string[]): Promise<string> {
    const metadata = await paneMetadata(segments);
    return typeof metadata.title === "string" ? metadata.title : "Deciduous";
}
