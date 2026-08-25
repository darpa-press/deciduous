import { getPieceByPage } from "@/lib/queries";
import { PieceBody } from "./PieceBody";
import { PieceCard, type CardPiece } from "./PieceCard";
import { CardOverlay } from "./CardOverlay";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A single piece as a pane.
 *
 * The `123c` form of the segment shows the catalogue card laid over the piece,
 * rather than instead of it — the piece stays behind the sheet, as it does on
 * the live site.
 */
export async function PiecePane({
    page,
    index,
    card = false,
}: {
    page: number;
    index: number;
    card?: boolean;
}) {
    const piece = await getPieceByPage(page);
    if (!piece) return <NotFoundPane segment={String(page)} />;

    return (
        <>
            {card && (
                <CardOverlay index={index} page={page}>
                    <PieceCard piece={piece as unknown as CardPiece} index={index} />
                </CardOverlay>
            )}
            <PieceBody piece={piece} index={index} />
        </>
    );
}
