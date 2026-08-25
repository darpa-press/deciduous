import { getPieceByPage } from "@/lib/queries";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A single piece as a pane.
 *
 * The legacy version fetched on mount, cached into sessionStorage and showed a
 * spinner meanwhile. As a server component in a persisted layout it queries
 * once and then stays put across navigation.
 */
export async function PiecePane({ page, index }: { page: number; index: number }) {
    const piece = await getPieceByPage(page);
    if (!piece) return <NotFoundPane segment={String(page)} />;

    return <PieceBody piece={piece} index={index} />;
}
