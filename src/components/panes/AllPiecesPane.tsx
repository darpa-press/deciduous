import { getAllPieces } from "@/lib/queries";
import { PieceBody } from "./PieceBody";

/** Every piece, rendered in full, one after another — the whole codex as a single scroll. */
export async function AllPiecesPane({ index }: { index: number }) {
    const pieces = await getAllPieces({ sort: "title", order: 1 });

    return (
        <div>
            {pieces.map((piece) => (
                <PieceBody key={String(piece._id)} piece={piece} index={index} isInList />
            ))}
        </div>
    );
}
