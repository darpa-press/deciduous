import { paneMetadata } from "@/lib/pane-metadata";

/**
 * The panes themselves are rendered by the layouts above; this page exists so
 * the route resolves, and to set the document title — it is the only component
 * at this depth that sees every segment.
 */
export async function generateMetadata({ params }: PageProps<"/[p1]">) {
    const { p1 } = await params;
    return paneMetadata([p1]);
}

export default function Page() {
    return null;
}
