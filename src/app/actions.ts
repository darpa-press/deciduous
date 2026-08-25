"use server";

import { searchPieces } from "@/lib/queries";

export interface SearchHit {
    id: string;
    page?: number;
    title?: string;
}

/**
 * Full-text search, called from the search overlay.
 *
 * The legacy client wrapped the term in quotes before sending it, which turns
 * a Mongo $text query into a phrase match — so "green paper" finds that phrase
 * rather than any piece containing either word. Preserved.
 */
export async function search(term: string): Promise<SearchHit[]> {
    const trimmed = term.trim();
    if (!trimmed) return [];

    const pieces = await searchPieces(`"${trimmed}"`);
    return pieces.map((piece) => ({
        id: String(piece._id),
        page: piece.page,
        title: piece.title,
    }));
}
