import { getAllPieces } from "@/lib/queries";
import { PieceBody } from "./PieceBody";

/**
 * The most recent pieces, in full, one after another. Ported from
 * Pages/AllPieces.
 *
 * Despite the `/all` segment this is not everything: the legacy page asked for
 * the last 300 by page number, newest first, and titled itself accordingly.
 * The codex has 118 pieces, so the limit does not bite yet — but the *order*
 * does, and it is the reverse of the alphabetical index.
 */

export const ALL_PIECES_LIMIT = 300;

export async function AllPiecesPane({ index }: { index: number }) {
    const pieces = await getAllPieces({ sort: "page", order: -1, limit: ALL_PIECES_LIMIT });

    return (
        <div>
            {pieces.map((piece) => (
                <PieceBody key={String(piece._id)} piece={piece} index={index} isInList />
            ))}
        </div>
    );
}
