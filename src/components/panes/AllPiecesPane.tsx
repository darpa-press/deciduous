import { getAllPieces } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";
import { PieceBody } from "./PieceBody";

/**
 * Every piece, rendered in full, one after another — the whole codex as a
 * single scroll. Ported from Pages/AllPieces.
 */
export async function AllPiecesPane({ pathArray, index }: { pathArray: string[]; index: number }) {
    const pieces = await getAllPieces({ sort: "title", order: 1 });
    const createLink = buildCreateLink(pathArray, index);

    return (
        <div>
            {pieces.map((piece) => (
                <PieceBody
                    key={String(piece._id)}
                    piece={piece}
                    createLink={(target) => createLink(target, true)}
                    titleHref={createLink(String(piece.page), false)}
                />
            ))}
        </div>
    );
}
