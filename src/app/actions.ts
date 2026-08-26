"use server";

import { searchPieces } from "@/lib/queries";
import { searchQuery } from "@/lib/search-term";
import type { CardPiece } from "@/components/panes/PieceCard";

export interface SearchHit {
    id: string;
    page?: number;
    title?: string;
    /** Everything the catalogue card needs; results render as cards. */
    card: CardPiece;
}

/**
 * Full-text search, called from the search overlay.
 *
 * The legacy client wrapped the term in quotes before sending it, which turns
 * a Mongo $text query into a phrase match — so "green paper" finds that phrase
 * rather than any piece containing either word. Preserved.
 */
export async function search(term: string): Promise<SearchHit[]> {
    // Bounded and quote-stripped before it can reach the cached wrapper — see
    // lib/search-term for why both matter on a public entry point.
    const query = searchQuery(term);
    if (!query) return [];

    const pieces = await searchPieces(query);
    return pieces.map((piece) => ({
        id: String(piece._id),
        page: piece.page,
        title: piece.title,
        card: piece as unknown as CardPiece,
    }));
}
