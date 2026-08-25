import { getPieceByPage } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A single piece as a pane.
 *
 * The legacy version was a class component that fetched on mount, cached into
 * sessionStorage and showed a spinner meanwhile. As a server component it
 * queries directly and streams — no client fetch, no loading state, no cache
 * to invalidate.
 */
export async function PiecePane({
    page,
    pathArray,
    index,
}: {
    page: number;
    pathArray: string[];
    index: number;
}) {
    const piece = await getPieceByPage(page);
    if (!piece) return <NotFoundPane segment={String(page)} />;

    const createLink = buildCreateLink(pathArray, index);

    return (
        <PieceBody
            piece={piece}
            createLink={(target) => createLink(target, true)}
            titleHref={createLink("index", false)}
        />
    );
}
